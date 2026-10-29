import { CreditCard, IndianRupee, Receipt, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { StatGrid, StatTile } from "@/components/crm/stat-tile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import {
  bookingBalance,
  depositTotals,
  formatINR,
  ledgerTotals,
  money,
  sumMoney,
} from "@/lib/money";
import { addDays, dateFromKey, formatIST, todayIST } from "@/lib/time";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { bookingVisibility } from "@/server/services/bookings";

/**
 * Accounts dashboard panel (MASTER_PROMPT §16).
 * Shows payments received, outstanding balances, deposits held, invoices, and recent transactions.
 * All totals are derived directly from ledger and booking records.
 */
export async function AccountsPanel({ user }: { user: CurrentUser }) {
  if (!can(user, "payments.read")) return null;

  const today = todayIST();
  const thirtyDaysAgoKey = addDays(today, -30);
  const thirtyDaysAgoDate = dateFromKey(thirtyDaysAgoKey);
  const visible = bookingVisibility(user);

  const [
    recentLedger,
    confirmedBookings,
    depositBookings,
    recentInvoicesCount,
    recentPaymentsList,
  ] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { occurredOn: { gte: thirtyDaysAgoDate } },
      select: { type: true, direction: true, amount: true },
    }),
    db.booking.findMany({
      where: {
        AND: [
          visible,
          { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } },
        ],
      },
      select: {
        id: true,
        bookingAmount: true,
        acceptedQuotation: { select: { grandTotal: true } },
        postEventCharges: { select: { lineTotal: true } },
        ledger: { select: { type: true, direction: true, amount: true } },
      },
      take: 1000,
    }),
    db.booking.findMany({
      where: {
        AND: [
          visible,
          { status: { not: "CANCELLED" } },
          { depositEntries: { some: {} } },
        ],
      },
      select: {
        depositEntries: { select: { type: true, amount: true } },
      },
      take: 1000,
    }),
    db.invoice.count({
      where: { issuedOn: { gte: thirtyDaysAgoDate } },
    }),
    db.ledgerEntry.findMany({
      where: { booking: visible },
      orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        occurredOn: true,
        type: true,
        direction: true,
        amount: true,
        method: true,
        receiptNumber: true,
        booking: { select: { id: true, reference: true, mainEventName: true } },
      },
    }),
  ]);

  const netReceived30Days = ledgerTotals(recentLedger).netReceived;

  let totalOutstanding = money(0);
  for (const b of confirmedBookings) {
    const bal = bookingBalance({
      acceptedTotal: b.acceptedQuotation?.grandTotal ?? b.bookingAmount ?? "0",
      postEventTotal: sumMoney(b.postEventCharges.map((c) => c.lineTotal)),
      ledger: b.ledger,
      deposits: [],
      cancelled: false,
    });
    if (bal.outstanding.greaterThan(0)) {
      totalOutstanding = totalOutstanding.plus(bal.outstanding);
    }
  }

  let totalHeldDeposits = money(0);
  for (const b of depositBookings) {
    const d = depositTotals(b.depositEntries);
    totalHeldDeposits = totalHeldDeposits.plus(d.held);
  }

  const tiles = [
    {
      label: "Net received (last 30 days)",
      value: formatINR(netReceived30Days),
      icon: IndianRupee,
    },
    {
      label: "Total outstanding balance",
      value: formatINR(totalOutstanding),
      icon: CreditCard,
    },
    {
      label: "Security deposits held",
      value: formatINR(totalHeldDeposits),
      icon: ShieldCheck,
    },
    {
      label: "Invoices issued (last 30 days)",
      value: recentInvoicesCount.toString(),
      icon: Receipt,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Accounts &amp; Finances
        </h2>
        <p className="text-sm text-text-muted">
          Real-time ledger and billing balances.
        </p>
      </div>

      <StatGrid>
        {tiles.map(({ label, value, icon }, i) => (
          <StatTile
            key={label}
            label={label}
            value={value}
            icon={icon}
            tone={i}
          />
        ))}
      </StatGrid>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent payment activity</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/payments">Payments and reports</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentPaymentsList.length ? (
            <ul className="divide-y divide-border">
              {recentPaymentsList.map((entry) => {
                const isIncoming = entry.direction === "IN";
                return (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/bookings/${entry.booking.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {entry.booking.reference}
                        </Link>
                        <span className="text-text-muted">
                          · {entry.booking.mainEventName}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted">
                        {entry.receiptNumber
                          ? `Receipt ${entry.receiptNumber} · `
                          : ""}
                        {entry.method
                          ? `${entry.method.replace("_", " ").toLowerCase()} · `
                          : ""}
                        {formatIST(entry.occurredOn, "d MMM yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isIncoming ? "success" : "secondary"}>
                        {entry.type.toLowerCase()}
                      </Badge>
                      <span
                        className={`font-semibold ${isIncoming ? "text-success" : "text-text-muted"}`}
                      >
                        {isIncoming ? "+" : "-"}
                        {formatINR(entry.amount)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">
              No payment transactions recorded yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
