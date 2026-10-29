import "server-only";

import type Decimal from "decimal.js";

import { db } from "@/lib/db";
import { formatINR, money, sumMoney } from "@/lib/money";
import type { DateRange } from "@/lib/reports/range";
import { addDays, dateFromKey, istToUtc } from "@/lib/time";
import { can, type Actor } from "@/server/policies/authorize";

import { labelOf, lookupOptions } from "./lookups";
import { PAYMENT_METHODS } from "./money";

/**
 * Simple reports (owner request, 27 Oct 2026): a few pie charts for running
 * the venue day to day, shown on the Payments and reports page. Counts and
 * sums only, never names.
 */

export type PieSlice = { label: string; value: number };
export type PieReport = { key: string; title: string; description: string; slices: PieSlice[]; money?: boolean };

/** Groups rows by key, largest first, keeping at most 6 slices (the rest become "Other"). */
function slices(totals: Map<string, number>, label: (key: string) => string): PieSlice[] {
  const sorted = [...totals.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5).map(([k, v]) => ({ label: label(k), value: v }));
  const rest = sorted.slice(5).reduce((sum, [, v]) => sum + v, 0);
  return rest > 0 ? [...top, { label: "Other", value: rest }] : top;
}

function count<T>(rows: T[], key: (row: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + 1);
  return map;
}

/** The pie charts this user may see for the date range. */
export async function simpleReports(actor: Actor, { from, to }: DateRange): Promise<PieReport[]> {
  const start = istToUtc(from, "00:00");
  const end = istToUtc(addDays(to, 1), "00:00");
  const reports: PieReport[] = [];

  if (can(actor, "reports.sales")) {
    const [leads, sources, statuses, bookings, eventTypes] = await Promise.all([
      db.lead.findMany({ where: { deletedAt: null, createdAt: { gte: start, lt: end } }, select: { sourceKey: true, statusKey: true } }),
      lookupOptions("lead_source"),
      lookupOptions("lead_status"),
      db.booking.findMany({
        where: { deletedAt: null, status: { notIn: ["CANCELLED"] }, subEvents: { some: { date: { gte: dateFromKey(from), lte: dateFromKey(to) } } } },
        select: { mainEventTypeKey: true },
      }),
      lookupOptions("event_type"),
    ]);
    const outcome = (statusKey: string) => {
      const system = statuses.find((s) => s.value === statusKey)?.systemKey;
      return system === "WON" ? "Booked" : system === "LOST" ? "Lost" : "Still open";
    };
    reports.push(
      { key: "sources", title: "Where enquiries came from", description: `${leads.length} enquiries received`, slices: slices(count(leads, (l) => l.sourceKey), (k) => labelOf(sources, k)) },
      { key: "outcomes", title: "What happened to enquiries", description: "Enquiries received in the period, by result", slices: slices(count(leads, (l) => outcome(l.statusKey)), (k) => k) },
      { key: "events", title: "Bookings by event type", description: `${bookings.length} bookings with a function in the period`, slices: slices(count(bookings, (b) => b.mainEventTypeKey), (k) => labelOf(eventTypes, k)) },
    );
  }

  if (can(actor, "reports.financial")) {
    const payments = await db.ledgerEntry.findMany({
      where: { type: "PAYMENT", occurredOn: { gte: dateFromKey(from), lte: dateFromKey(to) } },
      select: { method: true, amount: true },
    });
    const byMethod = new Map<string, Decimal>();
    for (const p of payments) {
      const key = p.method ?? "OTHER";
      byMethod.set(key, (byMethod.get(key) ?? money(0)).plus(money(p.amount)));
    }
    // Sums stay Decimal; whole rupees as numbers are only used to size the slices.
    const totals = new Map([...byMethod].map(([k, v]) => [k, v.round().toNumber()]));
    reports.push({
      key: "payments",
      title: "Money received by method",
      description: `${formatINR(sumMoney([...byMethod.values()]))} received`,
      slices: slices(totals, (k) => PAYMENT_METHODS.find((m) => m.value === k)?.label ?? k),
      money: true,
    });
  }
  return reports;
}
