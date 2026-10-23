import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Tx = Pick<PrismaClient, "auditLog">;

export type AuditEntry = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  /** Before/after summary. Never include passwords, tokens, OTPs or document contents. */
  summary?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
};

/** Writes an append-only audit entry. Pass `tx` to keep it in the caller's transaction. */
export async function recordAudit(entry: AuditEntry, tx: Tx = db): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent?.slice(0, 500) ?? null,
    },
  });
}
