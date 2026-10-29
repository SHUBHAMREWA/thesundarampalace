import "server-only";

import type Decimal from "decimal.js";

import { db } from "@/lib/db";
import { ledgerTotals, money, roundMoney, sumMoney } from "@/lib/money";
import { monthsIn, type DateRange } from "@/lib/reports/range";
import { dateFromKey, dateKey } from "@/lib/time";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";

import { recordAudit } from "./audit";
import { labelOf, lookupOptions } from "./lookups";

/**
 * Money numbers for the Payments and reports page (owner request, 27 Oct 2026).
 *
 * - Turnover: business done — the accepted quotation of every confirmed,
 *   running or completed booking whose first function falls in the range,
 *   plus post-event charges on those bookings.
 * - Received: money actually collected in the range (payments − refunds ±
 *   adjustments, by ledger date). Security deposits are not income.
 * - Expenses: expenses dated in the range (paid or not).
 * - Profit = turnover − expenses; cash profit = received − expenses.
 * All sums are Decimal; nothing is stored.
 */

const FIRM = ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] as const;

export type MonthRow = {
  month: string;
  turnover: Decimal;
  received: Decimal;
  expenses: Decimal;
  profit: Decimal;
};

export async function financeSummary(actor: Actor, range: DateRange) {
  assertPermission(actor, "reports.financial");
  const from = dateFromKey(range.from);
  const to = dateFromKey(range.to);

  const [bookings, ledger, expenses, deposits, categories] = await Promise.all([
    db.booking.findMany({
      where: {
        deletedAt: null,
        status: { in: [...FIRM] },
        startDate: { gte: from, lte: to },
      },
      select: {
        id: true,
        startDate: true,
        bookingAmount: true,
        acceptedQuotation: { select: { grandTotal: true } },
        postEventCharges: { select: { lineTotal: true } },
        ledger: { select: { type: true, direction: true, amount: true } },
      },
    }),
    db.ledgerEntry.findMany({
      where: { occurredOn: { gte: from, lte: to } },
      select: { type: true, direction: true, amount: true, occurredOn: true },
    }),
    db.expense.findMany({
      where: { deletedAt: null, incurredOn: { gte: from, lte: to } },
      select: {
        amount: true,
        incurredOn: true,
        categoryKey: true,
        paymentStatus: true,
      },
    }),
    db.depositEntry.findMany({
      where: { occurredOn: { gte: from, lte: to } },
      select: { type: true, amount: true },
    }),
    lookupOptions("expense_category"),
  ]);

  const months = new Map<string, MonthRow>(
    monthsIn(range).map((m) => [
      m,
      {
        month: m,
        turnover: money(0),
        received: money(0),
        expenses: money(0),
        profit: money(0),
      },
    ]),
  );
  const row = (d: Date) => months.get(dateKey(d).slice(0, 7))!;

  let pending = money(0);
  for (const b of bookings) {
    const value = sumMoney([
      b.acceptedQuotation?.grandTotal ?? b.bookingAmount ?? 0,
      ...b.postEventCharges.map((c) => c.lineTotal),
    ]);
    const r = row(b.startDate!);
    r.turnover = r.turnover.plus(value);
    const due = value.minus(ledgerTotals(b.ledger).netReceived);
    if (due.greaterThan(0)) pending = pending.plus(due);
  }
  const byMonthLedger = new Map<string, typeof ledger>();
  for (const e of ledger) {
    const key = dateKey(e.occurredOn).slice(0, 7);
    byMonthLedger.set(key, [...(byMonthLedger.get(key) ?? []), e]);
  }
  for (const [key, entries] of byMonthLedger) {
    const r = months.get(key);
    if (r) r.received = ledgerTotals(entries).netReceived;
  }
  const byCategory = new Map<string, Decimal>();
  let unpaidExpenses = money(0);
  for (const e of expenses) {
    const r = row(e.incurredOn);
    r.expenses = r.expenses.plus(money(e.amount));
    byCategory.set(
      e.categoryKey,
      (byCategory.get(e.categoryKey) ?? money(0)).plus(money(e.amount)),
    );
    if (e.paymentStatus !== "PAID")
      unpaidExpenses = unpaidExpenses.plus(money(e.amount));
  }
  for (const r of months.values()) {
    r.turnover = roundMoney(r.turnover);
    r.expenses = roundMoney(r.expenses);
    r.profit = roundMoney(r.turnover.minus(r.expenses));
  }

  const monthly = [...months.values()];
  const turnover = sumMoney(monthly.map((m) => m.turnover));
  const received = ledgerTotals(ledger);
  const expenseTotal = sumMoney(monthly.map((m) => m.expenses));
  const depositIn = sumMoney(
    deposits.filter((d) => d.type === "RECEIVED").map((d) => d.amount),
  );
  const depositOut = sumMoney(
    deposits.filter((d) => d.type === "REFUNDED").map((d) => d.amount),
  );

  return {
    turnover,
    received: received.netReceived,
    refunds: received.refunds,
    expenses: expenseTotal,
    unpaidExpenses: roundMoney(unpaidExpenses),
    profit: roundMoney(turnover.minus(expenseTotal)),
    cashProfit: roundMoney(received.netReceived.minus(expenseTotal)),
    pending: roundMoney(pending),
    bookingCount: bookings.length,
    deposits: { received: depositIn, refunded: depositOut },
    monthly,
    expenseByCategory: [...byCategory.entries()]
      .sort((a, b) => b[1].comparedTo(a[1]))
      .map(([key, amount]) => ({
        key,
        label: labelOf(categories, key),
        amount: roundMoney(amount),
      })),
  };
}

export const PAYMENTS_PAGE_SIZE = 25;

/** Every ledger entry in the range, newest first, with its booking. */
export async function paymentsInRange(
  actor: Actor,
  range: DateRange,
  page: number,
) {
  assertPermission(actor, "payments.read");
  const where = {
    occurredOn: { gte: dateFromKey(range.from), lte: dateFromKey(range.to) },
  };
  const [total, rows] = await Promise.all([
    db.ledgerEntry.count({ where }),
    db.ledgerEntry.findMany({
      where,
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAYMENTS_PAGE_SIZE,
      take: PAYMENTS_PAGE_SIZE,
      select: {
        id: true,
        type: true,
        direction: true,
        amount: true,
        occurredOn: true,
        method: true,
        receiptNumber: true,
        transactionRef: true,
        booking: {
          select: {
            id: true,
            reference: true,
            mainEventName: true,
            deletedAt: true,
            customer: { select: { fullName: true } },
          },
        },
      },
    }),
  ]);
  const showNames = can(actor, "customers.read");
  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / PAYMENTS_PAGE_SIZE)),
    rows: rows.map((r) => ({
      ...r,
      booking: {
        ...r.booking,
        customer: showNames ? r.booking.customer : null,
      },
    })),
  };
}

/** Spreadsheet-safe CSV cell: quoted, and formula starters neutralised. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

const EXPORT_LIMIT = 10_000;

/** Every ledger entry in the range as CSV (for the accountant). Audit-logged. */
export async function paymentsCsv(
  actor: Actor,
  range: DateRange,
): Promise<string> {
  assertPermission(actor, "payments.read");
  const rows = await db.ledgerEntry.findMany({
    where: {
      occurredOn: { gte: dateFromKey(range.from), lte: dateFromKey(range.to) },
    },
    orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
    take: EXPORT_LIMIT,
    select: {
      occurredOn: true,
      type: true,
      direction: true,
      amount: true,
      method: true,
      receiptNumber: true,
      transactionRef: true,
      booking: {
        select: {
          reference: true,
          mainEventName: true,
          customer: { select: { fullName: true } },
        },
      },
    },
  });
  const showNames = can(actor, "customers.read");
  const lines = [
    [
      "Date",
      "Booking",
      "Event",
      "Customer",
      "Type",
      "Method",
      "Receipt",
      "Reference",
      "Amount (INR)",
    ]
      .map(csvCell)
      .join(","),
    ...rows.map((r) =>
      [
        dateKey(r.occurredOn),
        r.booking.reference,
        r.booking.mainEventName,
        showNames ? (r.booking.customer?.fullName ?? "") : "",
        r.type,
        r.method ?? "",
        r.receiptNumber ?? "",
        r.transactionRef ?? "",
        `${r.direction === "OUT" ? "-" : ""}${money(r.amount).toFixed(2)}`,
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  await recordAudit({
    actorId: actor.id,
    action: "payments.exported",
    entityType: "ledger",
    entityId: `${range.from}..${range.to}`,
    summary: { from: range.from, to: range.to, rows: rows.length },
  });
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
