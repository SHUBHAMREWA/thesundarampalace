import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { calendarYearIST } from "@/lib/time";

type Tx = Pick<PrismaClient, "$queryRaw">;

/**
 * Allocates the next number in a sequence atomically. Call it inside the
 * same transaction that creates the document: if that transaction rolls
 * back, the number is not consumed, so sequences stay gap-free.
 */
export async function allocateNumber(
  tx: Tx,
  type: string,
  period: string,
  prefix: string,
): Promise<{ value: number; prefix: string }> {
  const rows = await tx.$queryRaw<{ allocated: number; prefix: string }[]>`
    INSERT INTO "number_sequence" ("type", "period", "prefix", "nextValue", "updatedAt")
    VALUES (${type}, ${period}, ${prefix}, 2, now())
    ON CONFLICT ("type", "period")
    DO UPDATE SET "nextValue" = "number_sequence"."nextValue" + 1, "updatedAt" = now()
    RETURNING ("nextValue" - 1)::int AS allocated, "prefix"
  `;
  const row = rows[0];
  if (!row) throw new Error(`Could not allocate a ${type} number`);
  return { value: row.allocated, prefix: row.prefix };
}

export function formatReference(prefix: string, period: string, value: number): string {
  return `${prefix}-${period}-${String(value).padStart(5, "0")}`;
}

/** SP-L-2026-00042 — lead reference for the current IST calendar year. */
export async function nextLeadReference(tx: Tx, now: Date = new Date()): Promise<string> {
  const period = String(calendarYearIST(now));
  const { value, prefix } = await allocateNumber(tx, "lead", period, "SP-L");
  return formatReference(prefix, period, value);
}

/** SP-B-2026-00017 — booking reference for the current IST calendar year. */
export async function nextBookingReference(tx: Tx, now: Date = new Date()): Promise<string> {
  const period = String(calendarYearIST(now));
  const { value, prefix } = await allocateNumber(tx, "booking", period, "SP-B");
  return formatReference(prefix, period, value);
}
