import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/validation/phone";

import { recordActivity } from "../activity";
import { getSettings } from "../settings";

import type { WhatsAppProvider } from "./config";

/**
 * Webhooks: delivery updates (sent → delivered → read, or failed) and
 * messages customers send us. Signatures are checked before anything is read.
 */

export type DeliveryStatus = "SENT" | "DELIVERED" | "READ" | "FAILED";
const RANK: Record<string, number> = { PENDING: 0, NOT_SENT_NO_PROVIDER: 0, SENT: 1, DELIVERED: 2, READ: 3 };
/** A failed row with this many attempts is never retried. */
export const NO_RETRY_ATTEMPTS = 99;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Meta signs the raw body with the App secret: `X-Hub-Signature-256: sha256=<hex>`. */
export function validMetaSignature(rawBody: string, header: string | null, appSecret: string | null): boolean {
  if (!header || !appSecret) return false;
  return safeEqual(header, `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`);
}

/** Twilio: base64 HMAC-SHA1 of the full URL followed by each sorted param name and value. */
export function validTwilioSignature(url: string, params: Record<string, string>, header: string | null, authToken: string | null): boolean {
  if (!header || !authToken) return false;
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return safeEqual(header, createHmac("sha1", authToken).update(data, "utf8").digest("base64"));
}

/** Moves a logged message forward; updates arriving late or twice change nothing. */
export async function applyDeliveryStatus(update: { provider: WhatsAppProvider; providerMessageId: string; status: DeliveryStatus; at: Date; error?: string }) {
  const message = await db.outbox.findFirst({
    where: { channel: "whatsapp", provider: update.provider, providerMessageId: update.providerMessageId },
    select: { id: true, status: true, sentAt: true, deliveredAt: true, readAt: true, failedAt: true },
  });
  if (!message) return;
  if (update.status === "FAILED") {
    if ((RANK[message.status] ?? 0) >= RANK.DELIVERED) return;
    await db.outbox.update({
      where: { id: message.id },
      data: { status: "FAILED", failedAt: message.failedAt ?? update.at, lastError: (update.error ?? "Failed").slice(0, 500), attempts: NO_RETRY_ATTEMPTS, nextAttemptAt: null },
    });
    return;
  }
  const field = { SENT: "sentAt", DELIVERED: "deliveredAt", READ: "readAt" }[update.status] as "sentAt" | "deliveredAt" | "readAt";
  const higher = message.status !== "FAILED" && RANK[update.status] > (RANK[message.status] ?? 0);
  await db.outbox.update({
    where: { id: message.id },
    data: {
      ...(higher ? { status: update.status } : {}),
      ...(message[field] ? {} : { [field]: update.at }),
      // A read message was delivered too, even if that update never arrived.
      ...(update.status === "READ" && !message.deliveredAt ? { deliveredAt: update.at } : {}),
    },
  });
}

const STOP_WORDS = new Set(["stop", "stop all", "unsubscribe", "band", "band karo", "बंद", "बंद करो"]);

export function isStopRequest(body: string): boolean {
  return STOP_WORDS.has(body.trim().toLowerCase().replace(/[.!।]+$/u, "").trim());
}

/** Finds who sent a message: a customer first (by mobile or WhatsApp number), else the latest lead. */
export async function matchSender(phone: string): Promise<{ type: "customer" | "lead"; id: string } | null> {
  const customer = await db.customer.findFirst({
    where: { deletedAt: null, mergedIntoId: null, anonymizedAt: null, OR: [{ mobile: phone }, { whatsapp: phone }] },
    select: { id: true },
  });
  if (customer) return { type: "customer", id: customer.id };
  const lead = await db.lead.findFirst({ where: { deletedAt: null, phone }, orderBy: { createdAt: "desc" }, select: { id: true } });
  return lead ? { type: "lead", id: lead.id } : null;
}

/**
 * Stores a customer's message. "STOP" (or "band karo") turns off WhatsApp
 * offers for that person at once (DPDP: withdrawing consent must be easy).
 */
export async function recordInbound(input: { provider: WhatsAppProvider; from: string; body: string; providerMessageId: string; at: Date }) {
  const phone = normalizePhone(input.from.startsWith("+") ? input.from : `+${input.from}`) ?? input.from;
  const exists = await db.inboundMessage.findUnique({ where: { providerMessageId: input.providerMessageId }, select: { id: true } });
  if (exists) return;
  const sender = await matchSender(phone);
  await db.inboundMessage.create({
    data: {
      provider: input.provider,
      fromAddress: phone,
      body: input.body.slice(0, 4000),
      providerMessageId: input.providerMessageId,
      relatedType: sender?.type ?? null,
      relatedId: sender?.id ?? null,
      receivedAt: input.at,
    },
  });
  if (!sender || !isStopRequest(input.body)) return;
  const { consentNoticeVersion } = await getSettings("enquiry");
  await db.$transaction(async (tx) => {
    await tx.consentRecord.create({
      data: { subjectType: sender.type === "customer" ? "CUSTOMER" : "LEAD", subjectId: sender.id, purpose: "marketing_whatsapp", granted: false, noticeVersion: consentNoticeVersion, source: OPT_OUT_SOURCE },
    });
    if (sender.type === "customer") {
      await recordActivity({ entityType: "customer", entityId: sender.id, kind: "CONSENT", message: "Replied STOP on WhatsApp: opted out of WhatsApp messages" }, tx);
    } else {
      await tx.leadActivity.create({ data: { leadId: sender.id, kind: "WHATSAPP", note: "Replied STOP on WhatsApp: opted out of WhatsApp messages" } });
    }
  });
}

/** Consent rows written by a STOP reply; they also block non-marketing bulk messages. */
export const OPT_OUT_SOURCE = "whatsapp_reply_stop";
