import "server-only";

import { randomBytes } from "node:crypto";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { openSecret, sealSecret } from "@/lib/security/secret-box";

/**
 * WhatsApp provider settings, typed in by the owner under Settings. Secrets
 * are stored encrypted (src/lib/security/secret-box.ts) and never sent to the
 * browser: forms only learn whether a secret is saved.
 */

export type WhatsAppProvider = "meta" | "twilio";

const SETTING_KEY = "whatsapp";

const storedSchema = z.object({
  provider: z.enum(["none", "meta", "twilio"]).default("none"),
  meta: z
    .object({
      phoneNumberId: z.string().default(""),
      wabaId: z.string().default(""),
      accessToken: z.string().nullable().default(null),
      appSecret: z.string().nullable().default(null),
      verifyToken: z.string().default(""),
    })
    .default({ phoneNumberId: "", wabaId: "", accessToken: null, appSecret: null, verifyToken: "" }),
  twilio: z
    .object({
      accountSid: z.string().default(""),
      authToken: z.string().nullable().default(null),
      from: z.string().default(""),
    })
    .default({ accountSid: "", authToken: null, from: "" }),
  /** Owner's own estimates (₹ per message) for the cost preview; never assumed by the app. */
  costMarketing: z.string().nullable().default(null),
  costUtility: z.string().nullable().default(null),
  maxPerCampaign: z.number().int().min(1).max(100_000).default(1000),
  test: z
    .object({ ok: z.boolean(), provider: z.string(), at: z.string(), detail: z.string() })
    .nullable()
    .default(null),
  lastWebhookAt: z.string().nullable().default(null),
});
type Stored = z.infer<typeof storedSchema>;

async function readStored(): Promise<Stored> {
  const row = await db.siteSetting.findUnique({ where: { key: SETTING_KEY } });
  const parsed = storedSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : storedSchema.parse({});
}

async function writeStored(value: Stored, updatedById: string | null) {
  const json = value as unknown as Prisma.InputJsonValue;
  await db.siteSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: json, updatedById },
    create: { key: SETTING_KEY, value: json, updatedById },
  });
}

export type MetaCredentials = { phoneNumberId: string; wabaId: string; accessToken: string; appSecret: string | null };
export type TwilioCredentials = { accountSid: string; authToken: string; from: string };
export type ActiveWhatsApp =
  | { provider: "meta"; meta: MetaCredentials }
  | { provider: "twilio"; twilio: TwilioCredentials };

function credentialsOf(stored: Stored): ActiveWhatsApp | null {
  if (stored.provider === "meta") {
    const accessToken = openSecret(stored.meta.accessToken);
    if (!stored.meta.phoneNumberId || !stored.meta.wabaId || !accessToken) return null;
    return { provider: "meta", meta: { phoneNumberId: stored.meta.phoneNumberId, wabaId: stored.meta.wabaId, accessToken, appSecret: openSecret(stored.meta.appSecret) } };
  }
  if (stored.provider === "twilio") {
    const authToken = openSecret(stored.twilio.authToken);
    if (!stored.twilio.accountSid || !stored.twilio.from || !authToken) return null;
    return { provider: "twilio", twilio: { accountSid: stored.twilio.accountSid, authToken, from: stored.twilio.from } };
  }
  return null;
}

/**
 * The provider to send with, or null. Sending needs the saved settings to
 * have passed the connection test, so a wrong key never reaches customers.
 */
export async function activeWhatsApp(): Promise<ActiveWhatsApp | null> {
  const stored = await readStored();
  if (!stored.test?.ok || stored.test.provider !== stored.provider) return null;
  return credentialsOf(stored);
}

/** Credentials for checking webhook signatures (also before the first test passes). */
export async function webhookCredentials() {
  const stored = await readStored();
  return {
    meta: { verifyToken: stored.meta.verifyToken, appSecret: openSecret(stored.meta.appSecret) },
    twilio: { authToken: openSecret(stored.twilio.authToken) },
  };
}

export async function markWebhookReceived(now = new Date()) {
  const stored = await readStored();
  // At most one write a minute: webhooks arrive in bursts during a campaign.
  if (stored.lastWebhookAt && now.getTime() - new Date(stored.lastWebhookAt).getTime() < 60_000) return;
  await writeStored({ ...stored, lastWebhookAt: now.toISOString() }, null);
}

export function webhookUrl(provider: WhatsAppProvider): string {
  return `${env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/api/webhooks/whatsapp/${provider}`;
}

/** What the Settings form may see: no secrets, only whether each one is saved. */
export type WhatsAppSettingsView = {
  provider: "none" | WhatsAppProvider;
  meta: { phoneNumberId: string; wabaId: string; hasAccessToken: boolean; hasAppSecret: boolean; verifyToken: string; webhookUrl: string };
  twilio: { accountSid: string; from: string; hasAuthToken: boolean; webhookUrl: string };
  costMarketing: string | null;
  costUtility: string | null;
  maxPerCampaign: number;
  test: Stored["test"];
  lastWebhookAt: string | null;
  ready: boolean;
};

export async function whatsAppSettingsView(): Promise<WhatsAppSettingsView> {
  const stored = await readStored();
  return {
    provider: stored.provider,
    meta: {
      phoneNumberId: stored.meta.phoneNumberId,
      wabaId: stored.meta.wabaId,
      hasAccessToken: !!stored.meta.accessToken,
      hasAppSecret: !!stored.meta.appSecret,
      verifyToken: stored.meta.verifyToken,
      webhookUrl: webhookUrl("meta"),
    },
    twilio: { accountSid: stored.twilio.accountSid, from: stored.twilio.from, hasAuthToken: !!stored.twilio.authToken, webhookUrl: webhookUrl("twilio") },
    costMarketing: stored.costMarketing,
    costUtility: stored.costUtility,
    maxPerCampaign: stored.maxPerCampaign,
    test: stored.test,
    lastWebhookAt: stored.lastWebhookAt,
    ready: !!stored.test?.ok && stored.test.provider === stored.provider && !!credentialsOf(stored),
  };
}

const money = z
  .string()
  .trim()
  .default("")
  .transform((v) => v || null)
  .refine((v) => v === null || /^\d{1,4}(\.\d{1,4})?$/.test(v), "Enter an amount like 0.86");

export const whatsAppSettingsSchema = z.object({
  provider: z.enum(["none", "meta", "twilio"]),
  metaPhoneNumberId: z.string().trim().max(40).regex(/^\d*$/, "Only digits").default(""),
  metaWabaId: z.string().trim().max(40).regex(/^\d*$/, "Only digits").default(""),
  metaAccessToken: z.string().trim().max(1000).default(""),
  metaAppSecret: z.string().trim().max(200).default(""),
  twilioAccountSid: z.string().trim().max(40).regex(/^(AC[0-9a-fA-F]{32})?$/, "Starts with AC followed by 32 letters/digits").default(""),
  twilioAuthToken: z.string().trim().max(200).default(""),
  twilioFrom: z.string().trim().max(20).default(""),
  costMarketing: money,
  costUtility: money,
  maxPerCampaign: z.coerce.number().int("Whole number").min(1).max(100_000),
});
export type WhatsAppSettingsInput = z.infer<typeof whatsAppSettingsSchema>;

/**
 * Builds the settings to save. Empty secret fields keep the saved secret, so
 * staff never have to see or retype a key just to change another field.
 */
export async function draftWhatsAppSettings(input: WhatsAppSettingsInput, twilioFrom: string | null): Promise<{ next: Stored; credentials: ActiveWhatsApp | null }> {
  const stored = await readStored();
  const next: Stored = {
    ...stored,
    provider: input.provider,
    meta: {
      phoneNumberId: input.metaPhoneNumberId,
      wabaId: input.metaWabaId,
      accessToken: input.metaAccessToken ? sealSecret(input.metaAccessToken) : stored.meta.accessToken,
      appSecret: input.metaAppSecret ? sealSecret(input.metaAppSecret) : stored.meta.appSecret,
      verifyToken: stored.meta.verifyToken || randomBytes(18).toString("base64url"),
    },
    twilio: {
      accountSid: input.twilioAccountSid,
      authToken: input.twilioAuthToken ? sealSecret(input.twilioAuthToken) : stored.twilio.authToken,
      from: twilioFrom ?? "",
    },
    costMarketing: input.costMarketing,
    costUtility: input.costUtility,
    maxPerCampaign: input.maxPerCampaign,
  };
  return { next, credentials: credentialsOf(next) };
}

export async function saveWhatsAppSettings(next: Stored, test: NonNullable<Stored["test"]> | null, updatedById: string) {
  await writeStored({ ...next, test }, updatedById);
}

export async function recordWhatsAppTest(test: NonNullable<Stored["test"]>, updatedById: string) {
  await writeStored({ ...(await readStored()), test }, updatedById);
}

/** Credentials as saved, for "Test again" (ignores the last test result). */
export async function savedWhatsAppCredentials(): Promise<ActiveWhatsApp | null> {
  return credentialsOf(await readStored());
}

export async function whatsAppCosts() {
  const stored = await readStored();
  return { marketing: stored.costMarketing, utility: stored.costUtility, maxPerCampaign: stored.maxPerCampaign };
}
