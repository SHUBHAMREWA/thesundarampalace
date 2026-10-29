import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { isFirm, plateDifference } from "@/lib/booking/rules";
import { db } from "@/lib/db";
import {
  allocateToInstalments,
  amountInWordsINR,
  bookingBalance,
  computeQuote,
  creditForTaxable,
  depositTotals,
  formatINR,
  money,
  roundMoney,
  sumMoney,
} from "@/lib/money";
import { dateFromKey, dateKey, todayIST } from "@/lib/time";
import {
  dateKeySchema,
  idempotencyKeySchema,
  optionalText,
  positiveMoneyString,
  quantityString,
  requiredText,
  moneyString,
} from "@/lib/validation/forms";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";

import { recordActivity } from "./activity";
import { recordAudit } from "./audit";
import { bookingVisibility, type MenuSnapshot } from "./bookings";
import { fieldError, isUniqueViolation, RuleError } from "./errors";
import { NotFoundError } from "./leads";
import { notifyStaff } from "./notifications";
import { nextGstDocumentNumber, nextReceiptNumber } from "./numbering";
import { getSettings } from "./settings";

/**
 * Money (MASTER_PROMPT §13, india-billing-gst skill). Every write is a new
 * append-only row inside a transaction, keyed by an idempotency key so a
 * double-click or a retried request records it once. Nothing is edited or
 * deleted: mistakes are reversed with an adjustment that names the entry.
 */

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CARD_OFFLINE", label: "Card (machine)" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTHER", label: "Other" },
] as const;
const METHOD_VALUES = PAYMENT_METHODS.map((m) => m.value) as [string, ...string[]];

async function requireBookingForMoney(actor: Actor, bookingId: string) {
  const booking = await db.booking.findFirst({ where: { AND: [{ id: bookingId }, bookingVisibility(actor)] } });
  if (!booking) throw new NotFoundError("Booking");
  return booking;
}

/** Runs `fn` once per idempotency key: a repeat returns without writing again. */
async function onceOnly<T>(fn: () => Promise<T>): Promise<T | { duplicate: true }> {
  try {
    return await fn();
  } catch (error) {
    if (isUniqueViolation(error)) return { duplicate: true };
    throw error;
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export async function moneySummary(actor: Actor, bookingId: string) {
  assertPermission(actor, "payments.read");
  const booking = await requireBookingForMoney(actor, bookingId);
  const [accepted, ledger, deposits, instalments, charges, invoices, creditNotes] = await Promise.all([
    booking.acceptedQuotationId ? db.quotationVersion.findUnique({ where: { id: booking.acceptedQuotationId } }) : null,
    db.ledgerEntry.findMany({ where: { bookingId }, orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }] }),
    db.depositEntry.findMany({ where: { bookingId }, orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }] }),
    db.paymentInstalment.findMany({ where: { bookingId }, orderBy: [{ dueOn: "asc" }, { sortOrder: "asc" }] }),
    db.postEventCharge.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" }, include: { invoiceLines: { select: { id: true } } } }),
    db.invoice.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" }, include: { lines: { orderBy: { sortOrder: "asc" } }, creditNotes: { include: { lines: true } } } }),
    db.creditNote.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } }),
  ]);
  const cancellation = booking.cancellation as { agreedRefund?: string } | null;
  const postEventTotal = sumMoney(charges.map((c) => c.lineTotal));
  const balance = bookingBalance({
    acceptedTotal: accepted?.grandTotal ?? booking.bookingAmount ?? "0",
    postEventTotal,
    ledger: ledger.map((e) => ({ type: e.type, direction: e.direction, amount: e.amount })),
    deposits: deposits.map((d) => ({ type: d.type, amount: d.amount })),
    cancelled: booking.status === "CANCELLED",
    agreedRefund: cancellation?.agreedRefund ?? null,
  });
  const schedule = allocateToInstalments(
    balance.netReceived,
    instalments.map((i) => ({ id: i.id, label: i.label, dueOn: dateKey(i.dueOn), amount: i.amount })),
    todayIST(),
  );
  const invoicedTotal = sumMoney(invoices.map((i) => i.grandTotal));
  const creditedTotal = sumMoney(creditNotes.map((c) => c.grandTotal));
  const reversedIds = new Set(ledger.filter((e) => e.reversesEntryId).map((e) => e.reversesEntryId!));
  return {
    booking,
    accepted,
    ledger: ledger.map((e) => ({ ...e, reversed: reversedIds.has(e.id) })),
    deposits,
    schedule,
    charges: charges.map((c) => ({ ...c, invoiced: c.invoiceLines.length > 0 })),
    invoices,
    creditNotes,
    balance,
    postEventTotal,
    invoicedTotal,
    creditedTotal,
    netInvoiced: roundMoney(invoicedTotal.minus(creditedTotal)),
    scheduleTotal: sumMoney(instalments.map((i) => i.amount)),
  };
}

// ─── Payments, refunds, adjustments ──────────────────────────────────────────

export const paymentSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  amount: positiveMoneyString("the amount"),
  occurredOn: dateKeySchema,
  method: z.enum(METHOD_VALUES, { error: "Choose how it was paid" }),
  transactionRef: optionalText(120),
  notes: optionalText(1000),
});

function assertNotFuture(date: string, field = "occurredOn") {
  if (date > todayIST()) fieldError(field, "The date can't be in the future");
}

/** Records a customer payment and allocates a receipt number in the same transaction. */
export async function recordPayment(actor: Actor, bookingId: string, input: z.infer<typeof paymentSchema>) {
  assertPermission(actor, "payments.create");
  const booking = await requireBookingForMoney(actor, bookingId);
  if (booking.status === "CANCELLED") throw new RuleError("This booking is cancelled; record a refund or an adjustment instead.");
  assertNotFuture(input.occurredOn);
  const { receiptPrefix } = await getSettings("numbering");
  return onceOnly(() =>
    db.$transaction(async (tx) => {
      const receiptNumber = await nextReceiptNumber(tx, dateFromKey(input.occurredOn), receiptPrefix);
      const entry = await tx.ledgerEntry.create({
        data: {
          bookingId,
          type: "PAYMENT",
          direction: "IN",
          amount: input.amount,
          occurredOn: dateFromKey(input.occurredOn),
          method: input.method as Prisma.LedgerEntryCreateInput["method"],
          transactionRef: input.transactionRef,
          receiptNumber,
          notes: input.notes,
          recordedById: actor.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await recordActivity({ entityType: "booking", entityId: bookingId, actorId: actor.id, kind: "PAYMENT", message: `Payment ${formatINR(input.amount)} received (${receiptNumber})` }, tx);
      await recordAudit({ actorId: actor.id, action: "payment.recorded", entityType: "ledger_entry", entityId: entry.id, summary: { booking: booking.reference, amount: input.amount, method: input.method, receiptNumber } }, tx);
      return entry;
    }),
  );
}

export const refundSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  amount: positiveMoneyString("the refund"),
  occurredOn: dateKeySchema,
  method: z.enum(METHOD_VALUES, { error: "Choose how it was refunded" }),
  transactionRef: optionalText(120),
  reason: requiredText("Reason", 500),
});

export async function recordRefund(actor: Actor, bookingId: string, input: z.infer<typeof refundSchema>) {
  assertPermission(actor, "refunds.create");
  const booking = await requireBookingForMoney(actor, bookingId);
  assertNotFuture(input.occurredOn);
  const ledger = await db.ledgerEntry.findMany({ where: { bookingId }, select: { type: true, direction: true, amount: true } });
  const net = bookingBalance({ acceptedTotal: "0", postEventTotal: "0", ledger, deposits: [], cancelled: false }).netReceived;
  if (money(input.amount).greaterThan(net)) fieldError("amount", `Refunds can't exceed the net amount received (${formatINR(net)})`);
  return onceOnly(() =>
    db.$transaction(async (tx) => {
      const entry = await tx.ledgerEntry.create({
        data: {
          bookingId,
          type: "REFUND",
          direction: "OUT",
          amount: input.amount,
          occurredOn: dateFromKey(input.occurredOn),
          method: input.method as Prisma.LedgerEntryCreateInput["method"],
          transactionRef: input.transactionRef,
          reason: input.reason,
          recordedById: actor.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await recordActivity({ entityType: "booking", entityId: bookingId, actorId: actor.id, kind: "REFUND", message: `Refund ${formatINR(input.amount)} paid — ${input.reason}` }, tx);
      await recordAudit({ actorId: actor.id, action: "refund.recorded", entityType: "ledger_entry", entityId: entry.id, summary: { booking: booking.reference, amount: input.amount, reason: input.reason } }, tx);
      return entry;
    }),
  );
}

export const adjustmentSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  amount: positiveMoneyString("the amount"),
  direction: z.enum(["IN", "OUT"]),
  occurredOn: dateKeySchema,
  reason: requiredText("Reason", 500),
  reversesEntryId: optionalText(50),
});

/**
 * Corrections. To undo a wrongly recorded payment or refund, pass
 * `reversesEntryId`: the adjustment mirrors it exactly (same amount,
 * opposite direction) and each entry can be reversed only once.
 */
export async function recordAdjustment(actor: Actor, bookingId: string, input: z.infer<typeof adjustmentSchema>) {
  assertPermission(actor, "refunds.create");
  const booking = await requireBookingForMoney(actor, bookingId);
  assertNotFuture(input.occurredOn);
  let amount = input.amount;
  let direction = input.direction;
  let label = "Adjustment";
  if (input.reversesEntryId) {
    const original = await db.ledgerEntry.findFirst({ where: { id: input.reversesEntryId, bookingId }, include: { reversedBy: true } });
    if (!original) fieldError("reversesEntryId", "Choose an entry of this booking");
    if (original.reversedBy) fieldError("reversesEntryId", "That entry has already been reversed");
    if (original.reversesEntryId) fieldError("reversesEntryId", "A reversal can't itself be reversed; record a new entry instead");
    amount = original.amount.toFixed(2);
    direction = original.direction === "IN" ? "OUT" : "IN";
    label = `Reversal of ${original.receiptNumber ?? original.type.toLowerCase()}`;
  }
  return onceOnly(() =>
    db.$transaction(async (tx) => {
      const entry = await tx.ledgerEntry.create({
        data: {
          bookingId,
          type: "ADJUSTMENT",
          direction,
          amount,
          occurredOn: dateFromKey(input.occurredOn),
          reason: input.reason,
          reversesEntryId: input.reversesEntryId,
          recordedById: actor.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await recordActivity({ entityType: "booking", entityId: bookingId, actorId: actor.id, kind: "ADJUSTMENT", message: `${label}: ${direction === "IN" ? "+" : "−"}${formatINR(amount)} — ${input.reason}` }, tx);
      await recordAudit({ actorId: actor.id, action: "ledger.adjustment", entityType: "ledger_entry", entityId: entry.id, summary: { booking: booking.reference, amount, direction, reason: input.reason, reverses: input.reversesEntryId } }, tx);
      return entry;
    }),
  );
}

// ─── Payment schedule ────────────────────────────────────────────────────────

export const instalmentSchema = z.object({
  label: requiredText("Label", 80),
  dueOn: dateKeySchema,
  amount: positiveMoneyString("the amount"),
});

/** The schedule is a plan, not financial history, so it can change; every change is audited. */
export async function saveInstalment(actor: Actor, bookingId: string, id: string | null, input: z.infer<typeof instalmentSchema>) {
  assertPermission(actor, "payments.create");
  const booking = await requireBookingForMoney(actor, bookingId);
  if (booking.status === "CANCELLED") throw new RuleError("This booking is cancelled.");
  const data = { label: input.label, dueOn: dateFromKey(input.dueOn), amount: input.amount };
  const saved = await db.$transaction(async (tx) => {
    const row = id
      ? await tx.paymentInstalment.update({ where: { id, bookingId }, data })
      : await tx.paymentInstalment.create({ data: { ...data, bookingId, createdById: actor.id, sortOrder: (await tx.paymentInstalment.count({ where: { bookingId } })) * 10 } });
    await recordAudit({ actorId: actor.id, action: id ? "instalment.updated" : "instalment.created", entityType: "booking", entityId: bookingId, summary: { label: input.label, dueOn: input.dueOn, amount: input.amount } }, tx);
    return row;
  });
  return saved;
}

export async function removeInstalment(actor: Actor, bookingId: string, id: string) {
  assertPermission(actor, "payments.create");
  await requireBookingForMoney(actor, bookingId);
  const row = await db.paymentInstalment.findFirst({ where: { id, bookingId } });
  if (!row) throw new NotFoundError("Instalment");
  await db.$transaction(async (tx) => {
    await tx.paymentInstalment.delete({ where: { id } });
    await recordAudit({ actorId: actor.id, action: "instalment.removed", entityType: "booking", entityId: bookingId, summary: { label: row.label, dueOn: dateKey(row.dueOn), amount: row.amount.toFixed(2) } }, tx);
  });
}

// ─── Security deposit ────────────────────────────────────────────────────────

export const depositSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  type: z.enum(["RECEIVED", "DEDUCTION", "REFUNDED"]),
  amount: positiveMoneyString("the amount"),
  occurredOn: dateKeySchema,
  method: z.enum(["", ...METHOD_VALUES] as [string, ...string[]]).optional().transform((v) => (v ? v : null)),
  transactionRef: optionalText(120),
  reason: optionalText(500),
});

export async function recordDepositEntry(actor: Actor, bookingId: string, input: z.infer<typeof depositSchema>) {
  assertPermission(actor, "deposits.manage");
  const booking = await requireBookingForMoney(actor, bookingId);
  assertNotFuture(input.occurredOn);
  if (input.type === "DEDUCTION" && !input.reason) fieldError("reason", "Say what the deduction is for (damage, extra hours, …)");
  if (input.type !== "DEDUCTION" && !input.method) fieldError("method", "Choose how the money moved");
  const existing = await db.depositEntry.findMany({ where: { bookingId }, select: { type: true, amount: true } });
  const held = depositTotals(existing).held;
  if (input.type !== "RECEIVED" && money(input.amount).greaterThan(held)) fieldError("amount", `Only ${formatINR(held)} of the deposit is held`);
  return onceOnly(() =>
    db.$transaction(async (tx) => {
      const entry = await tx.depositEntry.create({
        data: {
          bookingId,
          type: input.type,
          amount: input.amount,
          occurredOn: dateFromKey(input.occurredOn),
          method: input.method as Prisma.DepositEntryCreateInput["method"],
          transactionRef: input.transactionRef,
          reason: input.reason,
          recordedById: actor.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      const words = { RECEIVED: "received", DEDUCTION: "deducted", REFUNDED: "refunded" }[input.type];
      await recordActivity({ entityType: "booking", entityId: bookingId, actorId: actor.id, kind: "DEPOSIT", message: `Security deposit ${words}: ${formatINR(input.amount)}${input.reason ? ` — ${input.reason}` : ""}` }, tx);
      await recordAudit({ actorId: actor.id, action: `deposit.${input.type.toLowerCase()}`, entityType: "deposit_entry", entityId: entry.id, summary: { booking: booking.reference, amount: input.amount, reason: input.reason } }, tx);
      return entry;
    }),
  );
}

// ─── Post-event charges ──────────────────────────────────────────────────────

export const chargeSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  kind: z.enum(["EXTRA_HOURS", "OTHER"]),
  subEventId: optionalText(50),
  description: requiredText("Description", 300),
  unit: requiredText("Unit", 40),
  quantity: quantityString,
  unitPrice: moneyString("the unit price"),
});

async function createCharge(
  tx: Prisma.TransactionClient,
  actor: Actor,
  booking: { id: string; reference: string },
  data: { kind: "EXTRA_PLATES" | "EXTRA_HOURS" | "OTHER"; subEventId: string | null; description: string; unit: string; quantity: string; unitPrice: string; idempotencyKey: string },
) {
  // No GST (owner decision, 26 Oct 2026): tax columns keep neutral values.
  const result = computeQuote([{ quantity: data.quantity, unitPrice: data.unitPrice, taxRatePercent: "0" }], { pricesIncludeTax: false, supplyType: "INTRA" });
  const line = result.lines[0];
  const charge = await tx.postEventCharge.create({
    data: {
      bookingId: booking.id,
      subEventId: data.subEventId,
      kind: data.kind,
      description: data.description,
      sacCode: "",
      unit: data.unit,
      quantity: data.quantity,
      unitPrice: data.unitPrice,
      taxRatePercent: "0",
      pricesIncludeTax: false,
      supplyType: "INTRA",
      taxableValue: line.taxableValue.toFixed(2),
      cgst: line.cgst.toFixed(2),
      sgst: line.sgst.toFixed(2),
      igst: line.igst.toFixed(2),
      lineTotal: line.lineTotal.toFixed(2),
      recordedById: actor.id,
      idempotencyKey: data.idempotencyKey,
    },
  });
  await recordActivity({ entityType: "booking", entityId: booking.id, actorId: actor.id, kind: "CHARGE", message: `Post-event charge: ${data.description} ${formatINR(line.lineTotal)}` }, tx);
  await recordAudit({ actorId: actor.id, action: "charge.recorded", entityType: "post_event_charge", entityId: charge.id, summary: { booking: booking.reference, total: line.lineTotal.toFixed(2) } }, tx);
  return charge;
}

export async function recordCharge(actor: Actor, bookingId: string, input: z.infer<typeof chargeSchema>) {
  assertPermission(actor, "payments.create");
  const booking = await requireBookingForMoney(actor, bookingId);
  if (!isFirm(booking.status)) throw new RuleError("Post-event charges apply to confirmed bookings.");
  if (input.subEventId && !(await db.bookingSubEvent.findFirst({ where: { id: input.subEventId, bookingId } }))) fieldError("subEventId", "Choose one of this booking's functions");
  return onceOnly(() => db.$transaction((tx) => createCharge(tx, actor, booking, { ...input, subEventId: input.subEventId })));
}

/** Bills plates served beyond the guarantee at the agreed per-plate rate (from the menu snapshot). */
export async function billExtraPlates(actor: Actor, subEventId: string, idempotencyKey: string) {
  assertPermission(actor, "payments.create");
  idempotencyKeySchema.parse(idempotencyKey);
  const subEvent = await db.bookingSubEvent.findUnique({ where: { id: subEventId }, include: { menuSelection: true, postEventCharges: { where: { kind: "EXTRA_PLATES" } } } });
  if (!subEvent?.menuSelection || subEvent.menuSelection.actualPlates === null) throw new RuleError("Record the plates actually served first.");
  const booking = await requireBookingForMoney(actor, subEvent.bookingId);
  if (subEvent.postEventCharges.length) throw new RuleError("Extra plates for this function are already billed.");
  const { extra } = plateDifference(subEvent.menuSelection.guaranteedPlates, subEvent.menuSelection.actualPlates);
  if (extra <= 0) throw new RuleError("No plates were served beyond the guarantee.");
  const snap = subEvent.menuSelection.snapshot as unknown as MenuSnapshot;
  const accepted = booking.acceptedQuotationId ? await db.quotationVersion.findUnique({ where: { id: booking.acceptedQuotationId }, include: { lines: { where: { kind: "PLATES", subEventId } } } }) : null;
  // The agreed rate: the accepted quotation's plate line if there is one, else the menu snapshot.
  const rate = accepted?.lines[0]?.unitPrice.toFixed(2) ?? snap.perPlateRate;
  return onceOnly(() =>
    db.$transaction((tx) =>
      createCharge(tx, actor, booking, {
        kind: "EXTRA_PLATES",
        subEventId,
        description: `Extra plates — ${subEvent.name} (${extra} beyond ${subEvent.menuSelection!.guaranteedPlates} guaranteed)`,
        unit: "plate",
        quantity: String(extra),
        unitPrice: rate,
        idempotencyKey,
      }),
    ),
  );
}

// ─── Invoices (no GST) ───────────────────────────────────────────────────────

/** `gstin`, `stateCode` and `stateName` only appear on invoices issued before GST was removed. */
export type SupplierSnapshot = { legalName: string; gstin?: string | null; address: string; stateCode?: string | null; stateName?: string | null; phone: string | null; email: string | null };
export type RecipientSnapshot = { name: string; companyName: string | null; gstin?: string | null; address: string | null; stateCode?: string | null; stateName?: string | null; phone: string | null };

/** Seller details printed on invoices; refuses to issue until Settings has them. */
async function supplierSnapshot(): Promise<SupplierSnapshot> {
  const business = await getSettings("business");
  const legalName = business.legalName || business.displayName;
  const missing = [!legalName && "legal name", !business.address && "address"].filter(Boolean);
  if (missing.length) throw new RuleError(`Add the business's ${missing.join(", ")} in Settings → Business details before issuing invoices.`);
  return { legalName: legalName!, address: business.address!, phone: business.phone, email: business.email };
}

export const invoiceSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  source: z.enum(["QUOTATION", "CHARGES"]),
  issuedOn: dateKeySchema,
  notes: optionalText(1000),
});

/**
 * Issues an invoice (no GST) — from the accepted quotation (once), or for the
 * post-event charges not yet invoiced. Values are copied exactly from those
 * records; the number is allocated in the same transaction (gap-free).
 */
export async function issueInvoice(actor: Actor, bookingId: string, input: z.infer<typeof invoiceSchema>) {
  assertPermission(actor, "invoices.issue");
  const booking = await db.booking.findFirst({ where: { AND: [{ id: bookingId }, bookingVisibility(actor)] }, include: { customer: true } });
  if (!booking) throw new NotFoundError("Booking");
  if (!isFirm(booking.status)) throw new RuleError("Invoices are issued for confirmed bookings.");
  assertNotFuture(input.issuedOn, "issuedOn");
  const supplier = await supplierSnapshot();
  const { invoicePrefix } = await getSettings("numbering");
  const { invoiceNotes } = await getSettings("tax");

  type Line = Omit<Prisma.InvoiceLineCreateManyInput, "invoiceId">;
  let lines: Line[] = [];
  let quotationVersionId: string | null = null;
  let roundOff = roundMoney(0);

  if (input.source === "QUOTATION") {
    if (!booking.acceptedQuotationId) throw new RuleError("There is no accepted quotation to invoice.");
    const already = await db.invoice.findFirst({ where: { bookingId, quotationVersionId: booking.acceptedQuotationId } });
    if (already) throw new RuleError(`The accepted quotation is already invoiced (${already.number}). Use a credit note for reductions, or invoice post-event charges.`);
    const version = await db.quotationVersion.findUniqueOrThrow({ where: { id: booking.acceptedQuotationId }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
    quotationVersionId = version.id;
    roundOff = roundMoney(version.roundOff);
    lines = version.lines.map((l, i) => ({
      sortOrder: (i + 1) * 10,
      description: l.subEventLabel ? `${l.description} — ${l.subEventLabel}` : l.description,
      sacCode: l.sacCode,
      unit: l.unit,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discount: money(l.discount).plus(money(l.allocatedDiscount)).toFixed(2),
      taxableValue: l.taxableValue,
      ratePercent: l.taxRatePercent,
      cgst: l.cgst,
      sgst: l.sgst,
      igst: l.igst,
      lineTotal: l.lineTotal,
      quotationLineId: l.id,
    }));
  } else {
    const charges = await db.postEventCharge.findMany({ where: { bookingId, invoiceLines: { none: {} } }, orderBy: { createdAt: "asc" } });
    if (!charges.length) throw new RuleError("There are no post-event charges waiting to be invoiced.");
    lines = charges.map((c, i) => ({
      sortOrder: (i + 1) * 10,
      description: c.description,
      sacCode: c.sacCode,
      unit: c.unit,
      quantity: c.quantity,
      unitPrice: c.unitPrice,
      discount: "0",
      taxableValue: c.taxableValue,
      ratePercent: c.taxRatePercent,
      cgst: c.cgst,
      sgst: c.sgst,
      igst: c.igst,
      lineTotal: c.lineTotal,
      postEventChargeId: c.id,
    }));
  }
  const recipientAddress = [booking.customer.address, booking.customer.locality, booking.customer.city].filter(Boolean).join(", ") || null;
  const recipient: RecipientSnapshot = {
    name: booking.customer.fullName,
    companyName: booking.customer.companyName,
    address: recipientAddress,
    phone: booking.customer.mobile,
  };
  const sum = (key: "taxableValue" | "cgst" | "sgst" | "igst" | "lineTotal") => sumMoney(lines.map((l) => String(l[key])));
  const taxableTotal = sum("taxableValue");
  const cgstTotal = sum("cgst");
  const sgstTotal = sum("sgst");
  const igstTotal = sum("igst");
  const grandTotal = roundMoney(sum("lineTotal").plus(roundOff));
  return onceOnly(() =>
    db.$transaction(async (tx) => {
      const issuedOn = dateFromKey(input.issuedOn);
      const allocated = await nextGstDocumentNumber(tx, "invoice", invoicePrefix, issuedOn);
      const invoice = await tx.invoice.create({
        data: {
          number: allocated.number,
          financialYear: allocated.financialYear,
          sequence: allocated.sequence,
          bookingId,
          quotationVersionId,
          issuedOn,
          supplier: supplier as unknown as Prisma.InputJsonValue,
          recipient: recipient as unknown as Prisma.InputJsonValue,
          placeOfSupplyStateCode: "",
          supplyType: "INTRA",
          pricesIncludeTax: false,
          taxableTotal: taxableTotal.toFixed(2),
          cgstTotal: cgstTotal.toFixed(2),
          sgstTotal: sgstTotal.toFixed(2),
          igstTotal: igstTotal.toFixed(2),
          taxTotal: sumMoney([cgstTotal, sgstTotal, igstTotal]).toFixed(2),
          roundOff: roundOff.toFixed(2),
          grandTotal: grandTotal.toFixed(2),
          amountInWords: amountInWordsINR(grandTotal),
          notes: input.notes ?? invoiceNotes,
          issuedById: actor.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.invoiceLine.createMany({ data: lines.map((l) => ({ ...l, invoiceId: invoice.id })) });
      await recordActivity({ entityType: "booking", entityId: bookingId, actorId: actor.id, kind: "INVOICE", message: `Invoice ${invoice.number} issued (${formatINR(grandTotal)})` }, tx);
      await recordAudit({ actorId: actor.id, action: "invoice.issued", entityType: "invoice", entityId: invoice.id, summary: { number: invoice.number, booking: booking.reference, grandTotal: grandTotal.toFixed(2) } }, tx);
      return invoice;
    }),
  );
}

// ─── Credit notes ────────────────────────────────────────────────────────────

export const creditNoteSchema = z.object({
  idempotencyKey: idempotencyKeySchema,
  issuedOn: dateKeySchema,
  reason: requiredText("Reason", 500),
  /** "all" credits everything still creditable; otherwise per-line taxable amounts. */
  mode: z.enum(["all", "lines"]),
  lines: z.record(z.string(), z.string()).default({}),
});

/** What is still creditable on each line of an invoice. */
export async function creditableLines(invoiceId: string) {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { lines: { orderBy: { sortOrder: "asc" }, include: { creditNoteLines: true } } } });
  if (!invoice) throw new NotFoundError("Invoice");
  return {
    invoice,
    lines: invoice.lines.map((line) => {
      const credited = (key: "taxableValue" | "cgst" | "sgst" | "igst" | "lineTotal") => sumMoney(line.creditNoteLines.map((c) => c[key]));
      return {
        line,
        remaining: {
          taxableValue: roundMoney(money(line.taxableValue).minus(credited("taxableValue"))),
          cgst: roundMoney(money(line.cgst).minus(credited("cgst"))),
          sgst: roundMoney(money(line.sgst).minus(credited("sgst"))),
          igst: roundMoney(money(line.igst).minus(credited("igst"))),
          lineTotal: roundMoney(money(line.lineTotal).minus(credited("lineTotal"))),
        },
      };
    }),
  };
}

/**
 * Issues a credit note against an invoice (own gap-free number sequence).
 * Tax is credited at the line's rate; crediting the whole remainder of a
 * line credits exactly what is left, so totals never drift by a paisa.
 */
export async function issueCreditNote(actor: Actor, invoiceId: string, input: z.infer<typeof creditNoteSchema>) {
  assertPermission(actor, "credit_notes.issue");
  const { invoice, lines } = await creditableLines(invoiceId);
  const booking = await requireBookingForMoney(actor, invoice.bookingId);
  if (input.issuedOn < dateKey(invoice.issuedOn)) fieldError("issuedOn", "A credit note can't be dated before its invoice");
  assertNotFuture(input.issuedOn, "issuedOn");
  const credit: Omit<Prisma.CreditNoteLineCreateManyInput, "creditNoteId">[] = [];
  for (const { line, remaining } of lines) {
    const requested = input.mode === "all" ? remaining.taxableValue : money((input.lines[line.id] ?? "").replace(/,/g, "") || "0");
    if (requested.isNegative() || !requested.isFinite()) fieldError(`lines.${line.id}`, "Enter a positive amount");
    if (requested.isZero()) continue;
    if (requested.greaterThan(remaining.taxableValue)) fieldError(`lines.${line.id}`, `At most ${formatINR(remaining.taxableValue)} can still be credited on this line`);
    const full = requested.equals(remaining.taxableValue);
    const tax = full ? remaining : creditForTaxable(requested, line.ratePercent, invoice.supplyType);
    credit.push({
      invoiceLineId: line.id,
      description: line.description,
      sacCode: line.sacCode,
      taxableValue: roundMoney(full ? remaining.taxableValue : tax.taxableValue).toFixed(2),
      ratePercent: line.ratePercent,
      cgst: tax.cgst.toFixed(2),
      sgst: tax.sgst.toFixed(2),
      igst: tax.igst.toFixed(2),
      lineTotal: (full ? remaining.lineTotal : tax.lineTotal).toFixed(2),
    });
  }
  if (!credit.length) throw new RuleError("Nothing to credit — enter an amount on at least one line.");
  const sum = (key: "taxableValue" | "cgst" | "sgst" | "igst" | "lineTotal") => sumMoney(credit.map((c) => String(c[key])));
  const grandTotal = sum("lineTotal");
  const remainingAfter = sumMoney(lines.map((l) => l.remaining.taxableValue)).minus(sum("taxableValue"));
  const { creditNotePrefix } = await getSettings("numbering");
  return onceOnly(() =>
    db.$transaction(async (tx) => {
      const issuedOn = dateFromKey(input.issuedOn);
      const allocated = await nextGstDocumentNumber(tx, "credit_note", creditNotePrefix, issuedOn);
      const note = await tx.creditNote.create({
        data: {
          number: allocated.number,
          financialYear: allocated.financialYear,
          sequence: allocated.sequence,
          invoiceId,
          bookingId: invoice.bookingId,
          issuedOn,
          reason: input.reason,
          supplyType: invoice.supplyType,
          taxableTotal: sum("taxableValue").toFixed(2),
          cgstTotal: sum("cgst").toFixed(2),
          sgstTotal: sum("sgst").toFixed(2),
          igstTotal: sum("igst").toFixed(2),
          taxTotal: sumMoney([sum("cgst"), sum("sgst"), sum("igst")]).toFixed(2),
          grandTotal: grandTotal.toFixed(2),
          amountInWords: amountInWordsINR(grandTotal),
          issuedById: actor.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.creditNoteLine.createMany({ data: credit.map((c) => ({ ...c, creditNoteId: note.id })) });
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: remainingAfter.lessThanOrEqualTo(0) ? "FULLY_CREDITED" : "PARTIALLY_CREDITED" } });
      await recordActivity({ entityType: "booking", entityId: invoice.bookingId, actorId: actor.id, kind: "CREDIT_NOTE", message: `Credit note ${note.number} against ${invoice.number} (${formatINR(grandTotal)}) — ${input.reason}` }, tx);
      await recordAudit({ actorId: actor.id, action: "credit_note.issued", entityType: "credit_note", entityId: note.id, summary: { number: note.number, invoice: invoice.number, booking: booking.reference, grandTotal: grandTotal.toFixed(2) } }, tx);
      return note;
    }),
  );
}

// ─── Reminders ───────────────────────────────────────────────────────────────

/**
 * Daily: instalments due today or overdue get one in-app reminder per day
 * to the booking owner and Accounts staff. Messages to customers come later
 * and only with consent (Phase 5).
 */
export async function sendPaymentDueReminders(now: Date = new Date()): Promise<number> {
  const today = todayIST(now);
  const due = await db.paymentInstalment.findMany({
    where: {
      dueOn: { lte: dateFromKey(today) },
      OR: [{ reminderSentOn: null }, { reminderSentOn: { lt: dateFromKey(today) } }],
      booking: { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] }, deletedAt: null },
    },
    include: { booking: { select: { id: true, reference: true, ownerId: true } } },
    take: 500,
  });
  if (!due.length) return 0;
  const accounts = await db.user.findMany({
    where: { active: true, roles: { some: { role: { permissions: { some: { permissionKey: "payments.create" } } } } } },
    select: { id: true },
  });
  let sent = 0;
  const byBooking = new Map<string, typeof due>();
  for (const row of due) byBooking.set(row.bookingId, [...(byBooking.get(row.bookingId) ?? []), row]);
  for (const [bookingId, rows] of byBooking) {
    const ledger = await db.ledgerEntry.findMany({ where: { bookingId }, select: { type: true, direction: true, amount: true } });
    const instalments = await db.paymentInstalment.findMany({ where: { bookingId } });
    const net = bookingBalance({ acceptedTotal: "0", postEventTotal: "0", ledger, deposits: [], cancelled: false }).netReceived;
    const schedule = allocateToInstalments(net, instalments.map((i) => ({ id: i.id, label: i.label, dueOn: dateKey(i.dueOn), amount: i.amount })), today);
    const unpaid = rows.filter((r) => schedule.find((s) => s.id === r.id)?.status !== "PAID");
    if (!unpaid.length) continue;
    const booking = rows[0].booking;
    const balance = sumMoney(unpaid.map((r) => schedule.find((s) => s.id === r.id)!.balance));
    await db.$transaction(async (tx) => {
      await notifyStaff(tx, {
        userIds: [...accounts.map((a) => a.id), ...(booking.ownerId ? [booking.ownerId] : [])],
        kind: "payment.due",
        title: `${booking.reference}: ${formatINR(balance)} due`,
        body: unpaid.map((r) => `${r.label} (due ${dateKey(r.dueOn)})`).join(", "),
        link: `/admin/bookings/${booking.id}?tab=money`,
      });
      await tx.paymentInstalment.updateMany({ where: { id: { in: unpaid.map((r) => r.id) } }, data: { reminderSentOn: dateFromKey(today) } });
    });
    sent += unpaid.length;
  }
  return sent;
}

export function canSeeMoney(actor: Actor) {
  return can(actor, "payments.read");
}
