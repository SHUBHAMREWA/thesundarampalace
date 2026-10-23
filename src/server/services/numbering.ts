import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { calendarYearIST, financialYearLabel, shortFinancialYear } from "@/lib/time";

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
export async function nextBookingReference(tx: Tx, now: Date = new Date(), prefix = "SP-B"): Promise<string> {
  const period = String(calendarYearIST(now));
  const allocated = await allocateNumber(tx, "booking", period, prefix);
  return formatReference(allocated.prefix, period, allocated.value);
}

/** SP-C-2026-00003 — customer reference. */
export async function nextCustomerReference(tx: Tx, now: Date = new Date(), prefix = "SP-C"): Promise<string> {
  const period = String(calendarYearIST(now));
  const allocated = await allocateNumber(tx, "customer", period, prefix);
  return formatReference(allocated.prefix, period, allocated.value);
}

/** SP-R-2026-27-00001 — payment receipt number per financial year (not a tax invoice). */
export async function nextReceiptNumber(tx: Tx, now: Date = new Date(), prefix = "SP-R"): Promise<string> {
  const period = financialYearLabel(now);
  const allocated = await allocateNumber(tx, "receipt", period, prefix);
  return formatReference(allocated.prefix, period, allocated.value);
}

/**
 * GST invoice / credit note number: PREFIX/26-27/0001. Sequential and
 * gap-free per financial year because it is allocated in the same
 * transaction that inserts the document. The prefix in force when the year's
 * first number is allocated is kept for the whole year.
 */
export async function nextGstDocumentNumber(
  tx: Tx,
  type: "invoice" | "credit_note",
  prefix: string,
  issuedOn: Date = new Date(),
): Promise<{ number: string; financialYear: string; sequence: number }> {
  const financialYear = financialYearLabel(issuedOn);
  const allocated = await allocateNumber(tx, type, financialYear, prefix);
  const number = `${allocated.prefix}/${shortFinancialYear(financialYear)}/${String(allocated.value).padStart(4, "0")}`;
  if (number.length > 16) throw new Error(`GST document number ${number} is longer than 16 characters`);
  return { number, financialYear, sequence: allocated.value };
}
