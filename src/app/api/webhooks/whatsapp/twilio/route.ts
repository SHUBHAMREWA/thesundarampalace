import { NextResponse, type NextRequest } from "next/server";

import { markWebhookReceived, webhookCredentials, webhookUrl } from "@/server/services/whatsapp/config";
import { applyDeliveryStatus, recordInbound, validTwilioSignature, type DeliveryStatus } from "@/server/services/whatsapp/webhooks";

/**
 * Twilio webhook: delivery updates (StatusCallback, set on every message) and
 * incoming messages (set this URL as the sender's "When a message comes in").
 */

const STATUS: Record<string, DeliveryStatus> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED", undelivered: "FAILED" };

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") params[key] = value;
  const { twilio } = await webhookCredentials();
  // Twilio signs the exact public URL it called, so use the configured site URL, not the proxied request URL.
  if (!validTwilioSignature(webhookUrl("twilio"), params, request.headers.get("x-twilio-signature"), twilio.authToken)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  await markWebhookReceived();
  const sid = params.MessageSid ?? params.SmsSid;
  if (sid && params.MessageStatus && !params.Body) {
    const status = STATUS[params.MessageStatus];
    if (status) {
      await applyDeliveryStatus({
        provider: "twilio",
        providerMessageId: sid,
        status,
        at: new Date(),
        error: status === "FAILED" ? `${params.ErrorMessage || "Failed"}${params.ErrorCode ? ` (code ${params.ErrorCode})` : ""}` : undefined,
      });
    }
  } else if (sid && params.From) {
    const media = Number(params.NumMedia ?? 0) > 0 ? " [attachment]" : "";
    await recordInbound({ provider: "twilio", from: params.From.replace(/^whatsapp:/, ""), body: (params.Body ?? "") + media || "[message]", providerMessageId: sid, at: new Date() });
  }
  // Empty TwiML: no automatic reply.
  return new NextResponse("<Response></Response>", { status: 200, headers: { "Content-Type": "text/xml" } });
}
