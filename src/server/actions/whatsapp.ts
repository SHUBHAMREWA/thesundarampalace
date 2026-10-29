"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/validation/phone";
import { assertPermission } from "@/server/policies/authorize";
import { recordAudit } from "@/server/services/audit";
import { fieldError, RuleError } from "@/server/services/errors";
import { createCampaign, deliverWhatsApp, previewCampaign } from "@/server/services/whatsapp/campaigns";
import {
  activeWhatsApp,
  draftWhatsAppSettings,
  recordWhatsAppTest,
  saveWhatsAppSettings,
  savedWhatsAppCredentials,
  webhookUrl,
  whatsAppSettingsSchema,
} from "@/server/services/whatsapp/config";
import { fillTemplate, listTemplates, sendTemplate, testConnection } from "@/server/services/whatsapp/providers";
import { checkbox, currentActor, formObject, runAction, text, type ActionState } from "./helpers";

/**
 * Save = test. New keys are only saved after Meta/Twilio accepts them, so a
 * typo never leaves the business with a broken WhatsApp setup.
 */
export async function saveWhatsAppSettingsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await currentActor();
    assertPermission(user, "settings.manage");
    const input = whatsAppSettingsSchema.parse(formObject(form));
    const twilioFrom = normalizePhone(input.twilioFrom);
    if (input.provider === "twilio" && !twilioFrom) fieldError("twilioFrom", "Enter the WhatsApp number in Twilio, e.g. +14155238886");
    const { next, credentials } = await draftWhatsAppSettings(input, twilioFrom);

    if (input.provider === "none") {
      await saveWhatsAppSettings(next, null, user.id);
      await recordAudit({ actorId: user.id, action: "whatsapp.settings_saved", entityType: "site_setting", entityId: "whatsapp", summary: { provider: "none" } });
      revalidatePath("/admin/settings");
      return { message: "WhatsApp messaging is off. Nothing will be sent." };
    }
    if (!credentials) {
      if (input.provider === "meta") {
        if (!input.metaPhoneNumberId) fieldError("metaPhoneNumberId", "Required");
        if (!input.metaWabaId) fieldError("metaWabaId", "Required");
        fieldError("metaAccessToken", "Required");
      }
      if (!input.twilioAccountSid) fieldError("twilioAccountSid", "Required");
      fieldError("twilioAuthToken", "Required");
    }
    const result = await testConnection(credentials);
    const test = { ok: result.ok, provider: input.provider, at: new Date().toISOString(), detail: result.detail };
    if (!result.ok) {
      return { ok: false, message: `Connection test failed, so nothing was saved. ${result.detail}` };
    }
    await saveWhatsAppSettings(next, test, user.id);
    await recordAudit({ actorId: user.id, action: "whatsapp.settings_saved", entityType: "site_setting", entityId: "whatsapp", summary: { provider: input.provider, tested: true } });
    revalidatePath("/admin/settings");
    return { message: `Saved and tested. ${result.detail}` };
  });
}

/** Re-runs the connection test with the saved keys (e.g. after Meta expires a token). */
export async function testWhatsAppAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await currentActor();
    assertPermission(user, "settings.manage");
    const credentials = await savedWhatsAppCredentials();
    if (!credentials) throw new RuleError("Save the WhatsApp settings first.");
    const result = await testConnection(credentials);
    await recordWhatsAppTest({ ok: result.ok, provider: credentials.provider, at: new Date().toISOString(), detail: result.detail }, user.id);
    revalidatePath("/admin/settings");
    if (!result.ok) return { ok: false, message: `Test failed: ${result.detail} Sending is paused until the test passes.` };
    return { message: `Working. ${result.detail}` };
  });
}

/** Sends one approved template to a number staff type in, and logs it. */
export async function sendTestMessageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await currentActor();
    assertPermission(user, "settings.manage");
    const active = await activeWhatsApp();
    if (!active) throw new RuleError("Save and test the connection first.");
    const to = normalizePhone(text(form, "phone") ?? "");
    if (!to) fieldError("phone", "Enter a valid mobile number");
    const template = (await listTemplates(active)).find((t) => t.key === text(form, "template"));
    if (!template) fieldError("template", "Choose an approved template");
    if (template.unsupported) fieldError("template", template.unsupported);
    const variables = Array.from({ length: template.variableCount }, (_, i) => text(form, `variables.${i}`) || "Test");
    const result = await sendTemplate(active, { to, template, variables, statusCallback: webhookUrl("twilio") });
    const now = new Date();
    await db.outbox.create({
      data: {
        channel: "whatsapp",
        template: template.name,
        toAddress: to,
        payload: { templateName: template.name, templateRef: template.ref, variables, text: fillTemplate(template.body, variables) },
        purpose: "test",
        provider: active.provider,
        createdById: user.id,
        attempts: 99,
        ...(result.status === "SENT"
          ? { status: "SENT", providerMessageId: result.providerMessageId, sentAt: now }
          : { status: "FAILED", failedAt: now, lastError: result.error.slice(0, 500) }),
      },
    });
    if (result.status === "FAILED") return { ok: false, message: `Not sent: ${result.error}` };
    return { message: "Test message sent. Its delivery status appears in WhatsApp → Messages." };
  });
}

function campaignFields(form: FormData) {
  const values = formObject(form);
  const variables: string[] = [];
  for (let i = 0; i < 20 && `variables.${i}` in values; i++) variables.push(values[`variables.${i}`] ?? "");
  return { ...values, variables };
}

/**
 * First submit previews (how many people, a sample message, rough cost); the
 * second, with "confirm" ticked, queues the messages and starts sending.
 */
export async function campaignAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await currentActor();
    const input = campaignFields(form);
    if (!checkbox(form, "confirm")) {
      const preview = await previewCampaign(user, input);
      return {
        ok: true,
        data: { stage: "preview", allowed: preview.allowed, skipped: preview.skipped, sample: preview.sample, category: preview.category, estimatedCost: preview.estimatedCost, overLimit: preview.overLimit },
      };
    }
    const { queued } = await createCampaign(user, input, Number(text(form, "expected") ?? -1));
    after(() => deliverWhatsApp(250));
    revalidatePath("/admin/messages");
    return { message: `${queued} messages queued. Sending has started.`, redirectTo: "/admin/messages?view=campaigns" };
  });
}

/** Sends queued messages now instead of waiting for the hourly run. */
export async function sendRemainingAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await currentActor();
    assertPermission(user, "messages.send");
    const { processed } = await deliverWhatsApp(250);
    revalidatePath("/admin/messages");
    return { message: processed ? `Tried ${processed} queued messages.` : "Nothing is waiting to be sent." };
  });
}
