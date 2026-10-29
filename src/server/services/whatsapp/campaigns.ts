import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { addDays, istToUtc } from "@/lib/time";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";

import { recordAudit } from "../audit";
import { fieldError, RuleError } from "../errors";

import { activeWhatsApp, webhookUrl, whatsAppCosts } from "./config";
import { fillTemplate, listTemplates, sendTemplate, type WhatsAppTemplate } from "./providers";
import { NO_RETRY_ATTEMPTS, OPT_OUT_SOURCE } from "./webhooks";

/**
 * Bulk WhatsApp: pick an approved template and an audience, preview who will
 * get it, then queue one log row per person. Consent rules (secure-customer-data):
 * MARKETING templates need a WhatsApp opt-in; other templates follow the
 * relationship (an enquiry or a customer record) unless the person replied STOP.
 */

export const AUDIENCES = [
  { value: "customers", label: "Customers" },
  { value: "leads", label: "Leads (enquiries)" },
  { value: "both", label: "Customers and leads" },
] as const;

export const campaignSchema = z.object({
  name: z.string().trim().min(2, "Give the campaign a name").max(120),
  template: z.string().min(1, "Choose a template"),
  audience: z.enum(["customers", "leads", "both"]),
  customerCategory: z.string().trim().max(50).default(""),
  leadStatus: z.string().trim().max(50).default(""),
  leadsFrom: z.string().trim().default(""),
  leadsTo: z.string().trim().default(""),
  variables: z.array(z.string().trim().max(500)).default([]),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

type Recipient = { phone: string; name: string; type: "customer" | "lead"; id: string };

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

async function audienceOf(actor: Actor, input: CampaignInput): Promise<Recipient[]> {
  const list: Recipient[] = [];
  if (input.audience !== "leads") {
    assertPermission(actor, "customers.read");
    const customers = await db.customer.findMany({
      where: { deletedAt: null, anonymizedAt: null, mergedIntoId: null, ...(input.customerCategory ? { categoryKey: input.customerCategory } : {}) },
      select: { id: true, fullName: true, mobile: true, whatsapp: true },
      orderBy: { createdAt: "asc" },
    });
    for (const c of customers) list.push({ phone: c.whatsapp || c.mobile, name: c.fullName, type: "customer", id: c.id });
  }
  if (input.audience !== "customers") {
    assertPermission(actor, "leads.read_all");
    const leads = await db.lead.findMany({
      where: {
        deletedAt: null,
        // Converted leads are reached through their customer record.
        customerId: null,
        ...(input.leadStatus ? { statusKey: input.leadStatus } : {}),
        ...(input.leadsFrom || input.leadsTo
          ? { createdAt: { ...(input.leadsFrom ? { gte: istToUtc(input.leadsFrom, "00:00") } : {}), ...(input.leadsTo ? { lt: istToUtc(addDays(input.leadsTo, 1), "00:00") } : {}) } }
          : {}),
      },
      select: { id: true, fullName: true, phone: true },
      orderBy: { createdAt: "desc" },
    });
    for (const l of leads) list.push({ phone: l.phone, name: l.fullName, type: "lead", id: l.id });
  }
  // One message per phone number, even if it is on several records.
  const seen = new Set<string>();
  return list.filter((r) => r.phone && !seen.has(r.phone) && seen.add(r.phone));
}

/** Latest consent per subject for the purposes that matter here. */
async function consentMap(recipients: Recipient[]) {
  const rows = await db.consentRecord.findMany({
    where: {
      purpose: { in: ["marketing_whatsapp", "contact"] },
      OR: [
        { subjectType: "CUSTOMER", subjectId: { in: recipients.filter((r) => r.type === "customer").map((r) => r.id) } },
        { subjectType: "LEAD", subjectId: { in: recipients.filter((r) => r.type === "lead").map((r) => r.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { subjectType: true, subjectId: true, purpose: true, granted: true, source: true },
  });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.subjectType}:${row.subjectId}:${row.purpose}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return (r: Recipient, purpose: "marketing_whatsapp" | "contact") => latest.get(`${r.type === "customer" ? "CUSTOMER" : "LEAD"}:${r.id}:${purpose}`);
}

async function split(recipients: Recipient[], category: string) {
  const consent = await consentMap(recipients);
  const allowed: Recipient[] = [];
  const skipped: Recipient[] = [];
  for (const r of recipients) {
    const whatsapp = consent(r, "marketing_whatsapp");
    const ok =
      category === "MARKETING"
        ? whatsapp?.granted === true
        : !(whatsapp && !whatsapp.granted && whatsapp.source === OPT_OUT_SOURCE) && (r.type === "customer" || consent(r, "contact")?.granted === true);
    (ok ? allowed : skipped).push(r);
  }
  return { allowed, skipped };
}

async function resolveTemplate(templateKey: string): Promise<{ template: WhatsAppTemplate; provider: "meta" | "twilio" }> {
  const active = await activeWhatsApp();
  if (!active) throw new RuleError("WhatsApp is not connected. Add and test the API keys in Settings first.");
  const template = (await listTemplates(active)).find((t) => t.key === templateKey);
  if (!template) fieldError("template", "This template is no longer approved. Choose another one.");
  if (template.unsupported) fieldError("template", `This template can't be sent from here: ${template.unsupported}`);
  return { template, provider: active.provider };
}

function variablesFor(template: WhatsAppTemplate, values: string[], recipient: Recipient): string[] {
  return Array.from({ length: template.variableCount }, (_, i) => (values[i] ?? "").replaceAll("{name}", firstName(recipient.name)) || "-");
}

export type CampaignPreview = {
  allowed: number;
  skipped: number;
  sample: string;
  category: string;
  /** Rough cost from the owner's own per-message estimate, if set. */
  estimatedCost: string | null;
  overLimit: number | null;
};

export async function previewCampaign(actor: Actor, raw: unknown): Promise<CampaignPreview> {
  assertPermission(actor, "messages.send");
  const input = campaignSchema.parse(raw);
  const { template } = await resolveTemplate(input.template);
  checkVariables(template, input.variables);
  const { allowed, skipped } = await split(await audienceOf(actor, input), template.category);
  const costs = await whatsAppCosts();
  const rate = template.category === "MARKETING" ? costs.marketing : costs.utility;
  const sampleRecipient = allowed[0] ?? { phone: "", name: "Guest", type: "customer" as const, id: "" };
  return {
    allowed: allowed.length,
    skipped: skipped.length,
    sample: fillTemplate(template.body, variablesFor(template, input.variables, sampleRecipient)),
    category: template.category,
    estimatedCost: rate ? money(rate).times(allowed.length).toFixed(2) : null,
    overLimit: allowed.length > costs.maxPerCampaign ? costs.maxPerCampaign : null,
  };
}

function checkVariables(template: WhatsAppTemplate, values: string[]) {
  for (let i = 0; i < template.variableCount; i++) {
    if (!values[i]?.trim()) fieldError(`variables.${i}`, `Fill in {{${i + 1}}}`);
  }
}

/**
 * Queues the campaign: one PENDING row per allowed person and a
 * SKIPPED_NO_CONSENT row per skipped person, so the log shows both.
 * `expectedCount` must match the preview the user confirmed.
 */
export async function createCampaign(actor: Actor, raw: unknown, expectedCount: number): Promise<{ id: string; queued: number }> {
  assertPermission(actor, "messages.send");
  const input = campaignSchema.parse(raw);
  const { template, provider } = await resolveTemplate(input.template);
  checkVariables(template, input.variables);
  const { allowed, skipped } = await split(await audienceOf(actor, input), template.category);
  if (allowed.length !== expectedCount) throw new RuleError(`The audience changed to ${allowed.length} people since the preview. Preview again before sending.`);
  if (!allowed.length) throw new RuleError("Nobody in this audience can receive this template.");
  const { maxPerCampaign } = await whatsAppCosts();
  if (allowed.length > maxPerCampaign) throw new RuleError(`This is more than the ${maxPerCampaign} people allowed per campaign (Settings → WhatsApp). Narrow the audience.`);

  const purpose = template.category === "MARKETING" ? "marketing_whatsapp" : "whatsapp_update";
  const row = (r: Recipient, status: "PENDING" | "SKIPPED_NO_CONSENT", campaignId: string) => {
    const variables = variablesFor(template, input.variables, r);
    return {
      channel: "whatsapp",
      template: template.name,
      toAddress: r.phone,
      payload: { templateName: template.name, templateRef: template.ref, variables, text: fillTemplate(template.body, variables) } as Prisma.InputJsonValue,
      purpose,
      status,
      provider,
      campaignId,
      createdById: actor.id,
      relatedType: r.type,
      relatedId: r.id,
      ...(status === "SKIPPED_NO_CONSENT" ? { attempts: NO_RETRY_ATTEMPTS, lastError: template.category === "MARKETING" ? "No WhatsApp opt-in" : "Opted out (replied STOP) or no contact consent" } : {}),
    };
  };
  const campaign = await db.$transaction(async (tx) => {
    const created = await tx.messageCampaign.create({
      data: {
        name: input.name,
        provider,
        templateName: template.name,
        templateRef: template.ref,
        templateCategory: template.category,
        variables: input.variables,
        audience: { audience: input.audience, customerCategory: input.customerCategory || null, leadStatus: input.leadStatus || null, leadsFrom: input.leadsFrom || null, leadsTo: input.leadsTo || null },
        recipientCount: allowed.length,
        skippedCount: skipped.length,
        createdById: actor.id,
      },
    });
    await tx.outbox.createMany({ data: [...allowed.map((r) => row(r, "PENDING", created.id)), ...skipped.map((r) => row(r, "SKIPPED_NO_CONSENT", created.id))] });
    await recordAudit({ actorId: actor.id, action: "whatsapp.campaign_created", entityType: "message_campaign", entityId: created.id, summary: { template: template.name, recipients: allowed.length, skipped: skipped.length } }, tx);
    return created;
  });
  return { id: campaign.id, queued: allowed.length };
}

const CONCURRENCY = 5;

/**
 * Sends queued WhatsApp rows. Runs right after a campaign is queued, from the
 * hourly cron, and from "Send remaining now". Provider rejections (4xx) are
 * final; network problems retry with backoff.
 */
export async function deliverWhatsApp(limit = 250, now: Date = new Date()): Promise<{ processed: number }> {
  const pending = await db.outbox.findMany({
    where: {
      channel: "whatsapp",
      status: { in: ["PENDING", "FAILED", "NOT_SENT_NO_PROVIDER"] },
      attempts: { lt: 5 },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  if (!pending.length) return { processed: 0 };
  const active = await activeWhatsApp();
  if (!active) {
    await db.outbox.updateMany({ where: { id: { in: pending.map((m) => m.id) }, status: "PENDING" }, data: { status: "NOT_SENT_NO_PROVIDER" } });
    return { processed: pending.length };
  }
  const statusCallback = webhookUrl("twilio");
  const queue = [...pending];
  const worker = async () => {
    for (let message = queue.shift(); message; message = queue.shift()) {
      const payload = message.payload as { templateName?: string; templateRef?: string; variables?: string[] };
      const attempts = message.attempts + 1;
      if (message.provider && message.provider !== active.provider) {
        await db.outbox.update({ where: { id: message.id }, data: { status: "FAILED", attempts: NO_RETRY_ATTEMPTS, failedAt: now, lastError: `Queued for ${message.provider}, but WhatsApp now uses ${active.provider}. Templates differ, so it was not sent.` } });
        continue;
      }
      const result = await sendTemplate(active, {
        to: message.toAddress,
        template: { name: payload.templateName ?? message.template, ref: payload.templateRef ?? "" },
        variables: payload.variables ?? [],
        statusCallback,
      });
      await db.outbox.update({
        where: { id: message.id },
        data:
          result.status === "SENT"
            ? { status: "SENT", attempts, provider: active.provider, providerMessageId: result.providerMessageId, sentAt: new Date(), lastError: null, nextAttemptAt: null }
            : {
                status: "FAILED",
                attempts: result.permanent ? NO_RETRY_ATTEMPTS : attempts,
                provider: active.provider,
                failedAt: new Date(),
                lastError: result.error.slice(0, 500),
                nextAttemptAt: result.permanent ? null : new Date(now.getTime() + 2 ** attempts * 5 * 60_000),
              },
      });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { processed: pending.length };
}

// ─── Message logs ────────────────────────────────────────────────────────────

export const MESSAGE_STATUSES = [
  { value: "PENDING", label: "Waiting to send" },
  { value: "SENT", label: "Sent" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "READ", label: "Read" },
  { value: "FAILED", label: "Failed" },
  { value: "SKIPPED_NO_CONSENT", label: "Skipped (no permission)" },
  { value: "NOT_SENT_NO_PROVIDER", label: "Not sent (WhatsApp not connected)" },
] as const;

export const messageQuerySchema = z.object({
  status: z.string().optional().default(""),
  campaign: z.string().optional().default(""),
  q: z.string().trim().max(40).optional().default(""),
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).catch(1).default(1),
});
export type MessageQuery = z.infer<typeof messageQuerySchema>;

const PAGE_SIZE = 50;

function dateRange(from: string, to: string) {
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (!valid(from) && !valid(to)) return undefined;
  return { ...(valid(from) ? { gte: istToUtc(from, "00:00") } : {}), ...(valid(to) ? { lt: istToUtc(addDays(to, 1), "00:00") } : {}) };
}

async function namesFor(rows: { relatedType: string | null; relatedId: string | null }[]) {
  const ids = (type: string) => [...new Set(rows.filter((r) => r.relatedType === type && r.relatedId).map((r) => r.relatedId!))];
  const [customers, leads] = await Promise.all([
    db.customer.findMany({ where: { id: { in: ids("customer") } }, select: { id: true, fullName: true } }),
    db.lead.findMany({ where: { id: { in: ids("lead") } }, select: { id: true, fullName: true } }),
  ]);
  return new Map([...customers, ...leads].map((r) => [r.id, r.fullName]));
}

export async function listMessages(actor: Actor, query: MessageQuery) {
  assertPermission(actor, "messages.read");
  const digits = query.q.replace(/\D/g, "");
  const where: Prisma.OutboxWhereInput = {
    channel: "whatsapp",
    ...(query.status ? { status: query.status } : {}),
    ...(query.campaign ? { campaignId: query.campaign } : {}),
    ...(digits.length >= 4 ? { toAddress: { contains: digits } } : {}),
    ...(dateRange(query.from, query.to) ? { createdAt: dateRange(query.from, query.to) } : {}),
  };
  const [rows, total] = await Promise.all([
    db.outbox.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { campaign: { select: { name: true } } } }),
    db.outbox.count({ where }),
  ]);
  const names = await namesFor(rows);
  return {
    rows: rows.map((r) => ({ ...r, text: (r.payload as { text?: string }).text ?? r.template, name: r.relatedId ? (names.get(r.relatedId) ?? null) : null })),
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function listReplies(actor: Actor, query: MessageQuery) {
  assertPermission(actor, "messages.read");
  const digits = query.q.replace(/\D/g, "");
  const where: Prisma.InboundMessageWhereInput = {
    ...(digits.length >= 4 ? { fromAddress: { contains: digits } } : {}),
    ...(dateRange(query.from, query.to) ? { receivedAt: dateRange(query.from, query.to) } : {}),
  };
  const [rows, total] = await Promise.all([
    db.inboundMessage.findMany({ where, orderBy: { receivedAt: "desc" }, skip: (query.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.inboundMessage.count({ where }),
  ]);
  const names = await namesFor(rows);
  return { rows: rows.map((r) => ({ ...r, name: r.relatedId ? (names.get(r.relatedId) ?? null) : null })), total, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listCampaigns(actor: Actor) {
  assertPermission(actor, "messages.read");
  const campaigns = await db.messageCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const counts = await db.outbox.groupBy({ by: ["campaignId", "status"], where: { campaignId: { in: campaigns.map((c) => c.id) } }, _count: { _all: true } });
  const creators = await db.user.findMany({ where: { id: { in: campaigns.map((c) => c.createdById).filter((v): v is string => !!v) } }, select: { id: true, name: true } });
  return campaigns.map((c) => {
    const byStatus = Object.fromEntries(counts.filter((x) => x.campaignId === c.id).map((x) => [x.status, x._count._all])) as Record<string, number>;
    return { ...c, byStatus, createdBy: creators.find((u) => u.id === c.createdById)?.name ?? null };
  });
}

/** WhatsApp messages sent to and received from one customer or lead. */
export async function messageHistory(actor: Actor, type: "customer" | "lead", id: string) {
  if (!can(actor, "messages.read")) return null;
  const [sent, received] = await Promise.all([
    db.outbox.findMany({ where: { channel: "whatsapp", relatedType: type, relatedId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.inboundMessage.findMany({ where: { relatedType: type, relatedId: id }, orderBy: { receivedAt: "desc" }, take: 50 }),
  ]);
  return [
    ...sent.map((m) => ({ id: m.id, direction: "out" as const, at: m.sentAt ?? m.createdAt, text: (m.payload as { text?: string }).text ?? m.template, status: m.status, error: m.lastError })),
    ...received.map((m) => ({ id: m.id, direction: "in" as const, at: m.receivedAt, text: m.body, status: null, error: null })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());
}
