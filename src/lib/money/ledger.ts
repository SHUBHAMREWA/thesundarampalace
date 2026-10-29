import Decimal from "decimal.js";

import { money, percentOf, roundMoney, sumMoney, type MoneyInput } from "./money";

/**
 * Booking balances (india-billing-gst skill), computed — never stored:
 *   outstanding = accepted quotation total + post-event charges
 *                 − (payments − refunds ± adjustments)
 * The security deposit is a separate ledger and is never revenue.
 */

export type LedgerLine = {
  id?: string;
  type: "PAYMENT" | "REFUND" | "ADJUSTMENT";
  direction: "IN" | "OUT";
  amount: MoneyInput;
};

export type DepositLine = { type: "RECEIVED" | "DEDUCTION" | "REFUNDED"; amount: MoneyInput };

export type InstalmentLine = { id: string; label: string; dueOn: string; amount: MoneyInput };

export type InstalmentStatus = "PAID" | "PARTLY_PAID" | "DUE" | "OVERDUE";

export function ledgerTotals(entries: LedgerLine[]) {
  const sum = (filter: (e: LedgerLine) => boolean) => sumMoney(entries.filter(filter).map((e) => e.amount));
  const payments = sum((e) => e.type === "PAYMENT");
  const refunds = sum((e) => e.type === "REFUND");
  const adjustmentsIn = sum((e) => e.type === "ADJUSTMENT" && e.direction === "IN");
  const adjustmentsOut = sum((e) => e.type === "ADJUSTMENT" && e.direction === "OUT");
  const netReceived = roundMoney(payments.minus(refunds).plus(adjustmentsIn).minus(adjustmentsOut));
  return { payments, refunds, adjustmentsIn, adjustmentsOut, netReceived };
}

export function depositTotals(entries: DepositLine[]) {
  const sum = (type: DepositLine["type"]) => sumMoney(entries.filter((e) => e.type === type).map((e) => e.amount));
  const received = sum("RECEIVED");
  const deducted = sum("DEDUCTION");
  const refunded = sum("REFUNDED");
  return { received, deducted, refunded, held: roundMoney(received.minus(deducted).minus(refunded)) };
}

/**
 * Applies the net amount received to the schedule in due-date order.
 * `today` is "YYYY-MM-DD" in Asia/Kolkata.
 */
export function allocateToInstalments(netReceived: MoneyInput, instalments: InstalmentLine[], today: string) {
  let remaining = roundMoney(netReceived);
  if (remaining.isNegative()) remaining = roundMoney(0);
  const sorted = [...instalments].sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return sorted.map((inst) => {
    const amount = roundMoney(inst.amount);
    const paid = Decimal.min(amount, remaining);
    remaining = remaining.minus(paid);
    const status: InstalmentStatus = paid.greaterThanOrEqualTo(amount)
      ? "PAID"
      : inst.dueOn < today
        ? "OVERDUE"
        : paid.greaterThan(0)
          ? "PARTLY_PAID"
          : "DUE";
    return { ...inst, amount, paid: roundMoney(paid), balance: roundMoney(amount.minus(paid)), status };
  });
}

export type BookingBalanceInput = {
  /** Grand total of the accepted quotation (incl. tax); 0 when none is accepted. */
  acceptedTotal: MoneyInput;
  postEventTotal: MoneyInput;
  ledger: LedgerLine[];
  deposits: DepositLine[];
  cancelled: boolean;
  /** For a cancelled booking: the refund agreed at cancellation. */
  agreedRefund?: MoneyInput | null;
};

export type PaymentStatus = "NOTHING_DUE" | "NOT_PAID" | "PARTLY_PAID" | "PAID" | "OVERPAID";

export function bookingBalance(input: BookingBalanceInput) {
  const totals = ledgerTotals(input.ledger);
  const deposit = depositTotals(input.deposits);
  const billable = roundMoney(money(input.acceptedTotal).plus(money(input.postEventTotal)));
  if (input.cancelled) {
    // After cancellation nothing more is billed; what's left is the refund still to pay.
    const agreedRefund = roundMoney(input.agreedRefund ?? 0);
    // Never more than is still held: a payment reversed as a mistake leaves nothing to refund.
    const refundStillDue = Decimal.max(roundMoney(0), Decimal.min(agreedRefund.minus(totals.refunds), totals.netReceived));
    return {
      ...totals,
      billable,
      outstanding: roundMoney(0),
      refundStillDue: roundMoney(refundStillDue),
      retained: roundMoney(totals.netReceived.minus(refundStillDue)),
      deposit,
      status: "NOTHING_DUE" as PaymentStatus,
    };
  }
  const outstanding = roundMoney(billable.minus(totals.netReceived));
  const status: PaymentStatus = billable.isZero()
    ? totals.netReceived.greaterThan(0)
      ? "OVERPAID"
      : "NOTHING_DUE"
    : totals.netReceived.lessThanOrEqualTo(0)
      ? "NOT_PAID"
      : outstanding.isNegative()
        ? "OVERPAID"
        : outstanding.isZero()
          ? "PAID"
          : "PARTLY_PAID";
  return { ...totals, billable, outstanding, refundStillDue: roundMoney(0), retained: totals.netReceived, deposit, status };
}

// ─── Cancellation ────────────────────────────────────────────────────────────

export type CancellationSlab = { daysBeforeEventMin: number; refundPercent: string };

export function sortSlabs(slabs: CancellationSlab[]): CancellationSlab[] {
  return [...slabs].sort((a, b) => b.daysBeforeEventMin - a.daysBeforeEventMin);
}

/**
 * Refund under the snapshotted policy: the slab with the largest
 * "days before" that the cancellation still meets. No slab → no refund.
 */
export function cancellationRefund(slabs: CancellationSlab[], daysBeforeEvent: number, netReceived: MoneyInput) {
  const slab = sortSlabs(slabs).find((s) => daysBeforeEvent >= s.daysBeforeEventMin) ?? null;
  const refundPercent = slab ? money(slab.refundPercent) : money(0);
  const base = Decimal.max(roundMoney(netReceived), 0);
  return { slab, refundPercent, refundAmount: percentOf(base, refundPercent) };
}

/** Suggested advance on confirmation, from the settings percentage. */
export function suggestedAdvance(acceptedTotal: MoneyInput, advancePercent: string | null): Decimal | null {
  if (!advancePercent) return null;
  return percentOf(acceptedTotal, advancePercent);
}
