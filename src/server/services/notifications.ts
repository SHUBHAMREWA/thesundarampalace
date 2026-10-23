import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";

import { sendEmail } from "./email";

type Tx = Pick<PrismaClient, "notification" | "outbox" | "user">;

/**
 * Staff notifications (docs/architecture.md ADR-10): an in-app notification
 * always, plus an outbox email that is delivered after the transaction.
 * Staff alerts are operational messages, not marketing, so no customer
 * consent applies; customer messages will check ConsentRecord (Phase 5).
 */
export async function notifyStaff(
  tx: Tx,
  input: {
    userIds: string[];
    kind: string;
    title: string;
    body?: string;
    link?: string;
    email?: { subject: string; text: string };
    related?: { type: string; id: string };
  },
): Promise<void> {
  const userIds = [...new Set(input.userIds)];
  if (!userIds.length) return;
  await tx.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    })),
  });
  if (!input.email) return;
  const users = await tx.user.findMany({ where: { id: { in: userIds }, active: true }, select: { email: true } });
  if (!users.length) return;
  await tx.outbox.createMany({
    data: users.map((user) => ({
      channel: "email",
      template: input.kind,
      toAddress: user.email,
      payload: input.email as unknown as Prisma.InputJsonValue,
      purpose: "staff_alert",
      relatedType: input.related?.type ?? null,
      relatedId: input.related?.id ?? null,
    })),
  });
}

const MAX_ATTEMPTS = 5;

/** Delivers pending outbox messages; failures retry with backoff (daily cron + after()). */
export async function deliverPendingOutbox(limit = 20, now: Date = new Date()): Promise<{ processed: number }> {
  const pending = await db.outbox.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  for (const message of pending) {
    if (message.channel !== "email") {
      await db.outbox.update({ where: { id: message.id }, data: { status: "NOT_SENT_NO_PROVIDER" } });
      continue;
    }
    const payload = message.payload as { subject?: string; text?: string };
    const result = await sendEmail({
      to: message.toAddress,
      subject: payload.subject ?? "The Sundaram Palace",
      text: payload.text ?? "",
    });
    const attempts = message.attempts + 1;
    await db.outbox.update({
      where: { id: message.id },
      data:
        result.status === "FAILED"
          ? {
              status: "FAILED",
              attempts,
              lastError: result.error.slice(0, 500),
              nextAttemptAt: new Date(now.getTime() + 2 ** attempts * 5 * 60_000),
            }
          : {
              status: result.status,
              attempts,
              lastError: null,
              providerMessageId: result.status === "SENT" ? result.providerMessageId : null,
            },
    });
  }
  return { processed: pending.length };
}
