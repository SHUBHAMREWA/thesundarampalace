import { NextResponse, type NextRequest } from "next/server";

import { markWebhookReceived, webhookCredentials } from "@/server/services/whatsapp/config";
import { applyDeliveryStatus, recordInbound, validMetaSignature, type DeliveryStatus } from "@/server/services/whatsapp/webhooks";

/**
 * Meta WhatsApp Cloud API webhook. In the Meta app dashboard set the callback
 * URL and verify token shown under Settings → WhatsApp, and subscribe to the
 * "messages" field.
 */

/** Meta's one-time check when the webhook is saved. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { meta } = await webhookCredentials();
  const token = params.get("hub.verify_token") ?? "";
  if (params.get("hub.mode") === "subscribe" && meta.verifyToken && token === meta.verifyToken) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

type MetaWebhook = {
  entry?: {
    changes?: {
      value?: {
        statuses?: { id: string; status: string; timestamp?: string; errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[] }[];
        messages?: { id: string; from: string; timestamp?: string; type?: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } } }[];
      };
    }[];
  }[];
};

const STATUS: Record<string, DeliveryStatus> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };

function when(timestamp: string | undefined): Date {
  const seconds = Number(timestamp);
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const { meta } = await webhookCredentials();
  if (!validMetaSignature(raw, request.headers.get("x-hub-signature-256"), meta.appSecret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let body: MetaWebhook;
  try {
    body = JSON.parse(raw) as MetaWebhook;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  await markWebhookReceived();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        const status = STATUS[s.status];
        if (!status) continue;
        const e = s.errors?.[0];
        await applyDeliveryStatus({
          provider: "meta",
          providerMessageId: s.id,
          status,
          at: when(s.timestamp),
          error: e ? `${e.error_data?.details || e.message || e.title || "Failed"}${e.code ? ` (code ${e.code})` : ""}` : undefined,
        });
      }
      for (const m of change.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? `[${m.type ?? "message"}]`;
        await recordInbound({ provider: "meta", from: m.from, body: text, providerMessageId: m.id, at: when(m.timestamp) });
      }
    }
  }
  // Meta retries anything that isn't a quick 200.
  return NextResponse.json({ ok: true });
}
