import "server-only";

import { env } from "@/lib/env";

export type EmailMessage = { to: string; subject: string; text: string };

export type SendResult =
  | { status: "SENT"; providerMessageId: string | null }
  | { status: "NOT_SENT_NO_PROVIDER" }
  | { status: "FAILED"; error: string };

/**
 * Email adapter (Resend REST API, free plan). Without RESEND_API_KEY nothing
 * is sent and the outbox records NOT_SENT_NO_PROVIDER — never a fake "sent".
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY || !EMAIL_FROM) return { status: "NOT_SENT_NO_PROVIDER" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      return { status: "FAILED", error: `Resend responded ${response.status}` };
    }
    const data = (await response.json().catch(() => ({}))) as { id?: string };
    return { status: "SENT", providerMessageId: data.id ?? null };
  } catch (error) {
    return { status: "FAILED", error: error instanceof Error ? error.message : "unknown error" };
  }
}
