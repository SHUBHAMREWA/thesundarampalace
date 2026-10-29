import { Banknote, BarChart3, CalendarRange, Download, HandCoins, Hourglass, PiggyBank, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MonthBars } from "@/components/crm/month-bars";
import { PageHeader } from "@/components/crm/page-header";
import { SectionTitle } from "@/components/crm/person-avatar";
import { PieChart } from "@/components/crm/pie-chart";
import { StatGrid, StatTile } from "@/components/crm/stat-tile";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatINR } from "@/lib/money";
import { RANGE_PRESETS, rangeFromParams } from "@/lib/reports/range";
import { dateKey, formatDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { financeSummary, paymentsInRange } from "@/server/services/finance";
import { PAYMENT_METHODS } from "@/server/services/money";
import { simpleReports } from "@/server/services/reports";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Payments and reports" };

const HEAD = "text-xs tracking-wide text-text-muted uppercase";
const TYPE_LABEL = { PAYMENT: "Payment", REFUND: "Refund", ADJUSTMENT: "Adjustment" } as const;

/**
 * Payments and reports (owner request, 27 Oct 2026): turnover, money received,
 * expenses and profit for any date range, every payment in that range, and
 * the enquiry/booking pie charts. Replaces the old Reports page.
 */
export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  const user = await requireUser();
  const params = await searchParams;
  const range = rangeFromParams(params);
  const page = Math.max(1, Math.min(10_000, Number(params.page) || 1));
  const financial = can(user, "reports.financial");
  const payments = can(user, "payments.read");
  const sales = can(user, "reports.sales");

  const [summary, list, pies] = await Promise.all([
    financial ? financeSummary(user, range) : null,
    payments ? paymentsInRange(user, range, page) : null,
    sales || financial ? simpleReports(user, range) : [],
  ]);

  const rangeQuery = range.preset ? `preset=${range.preset}` : `from=${range.from}&to=${range.to}`;
  const pageHref = (p: number) => `/admin/payments?${rangeQuery}${p > 1 ? `&page=${p}` : ""}#payments`;

  return (
    <>
      <PageHeader
        title="Payments and reports"
        description={`${formatDateKey(range.from)} – ${formatDateKey(range.to)}`}
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Payments and reports" }]}
        actions={
          payments ? (
            <Button asChild variant="outline" size="sm">
              <a href={`/api/reports/payments?from=${range.from}&to=${range.to}`} download>
                <Download aria-hidden="true" /> Download payments (CSV)
              </a>
            </Button>
          ) : undefined
        }
      />

      {/* Date range: quick presets, or any from–to dates. */}
      <div className="mb-6 space-y-3 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)]">
        <nav aria-label="Quick date ranges" className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((p) => (
            <Link
              key={p.value}
              href={`/admin/payments?preset=${p.value}`}
              aria-current={p.value === range.preset ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                p.value === range.preset ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-blush/40",
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label htmlFor="from" className="text-xs font-medium text-text-muted">From</label>
            <Input id="from" name="from" type="date" defaultValue={range.from} className="bg-surface" required />
          </div>
          <div className="space-y-1">
            <label htmlFor="to" className="text-xs font-medium text-text-muted">To</label>
            <Input id="to" name="to" type="date" defaultValue={range.to} className="bg-surface" required />
          </div>
          <Button type="submit" size="sm" className="mb-0.5">
            <CalendarRange aria-hidden="true" /> Show
          </Button>
          <p className="text-xs text-text-muted">Longest range: 3 years.</p>
        </form>
      </div>

      {!summary && !list && !pies.length ? <EmptyState icon={BarChart3} title="No reports for your role" /> : null}

      <div className="space-y-6">
        {summary ? (
          <>
            <StatGrid>
              <StatTile label={`Turnover · ${summary.bookingCount} confirmed ${summary.bookingCount === 1 ? "booking" : "bookings"}`} value={formatINR(summary.turnover)} icon={TrendingUp} tone="rose" />
              <StatTile label="Money received (after refunds)" value={formatINR(summary.received)} icon={HandCoins} tone="green" />
              <StatTile label="Expenses" value={formatINR(summary.expenses)} icon={ReceiptText} tone="amber" />
              <StatTile label="Profit (turnover − expenses)" value={formatINR(summary.profit)} icon={PiggyBank} tone={summary.profit.isNegative() ? "red" : "blue"} />
              <StatTile label="Cash profit (received − expenses)" value={formatINR(summary.cashProfit)} icon={Wallet} tone={summary.cashProfit.isNegative() ? "red" : "plum"} />
              <StatTile label="Still to collect on these bookings" value={formatINR(summary.pending)} icon={Hourglass} tone="gold" />
            </StatGrid>
            <p className="text-xs text-text-muted">
              Turnover counts confirmed, running and completed bookings whose first function is in this range (accepted quotation + post-event charges).
              Money received counts payments by the date they came in. Security deposits are not income: {formatINR(summary.deposits.received)} collected,{" "}
              {formatINR(summary.deposits.refunded)} returned in this range.
              {summary.unpaidExpenses.greaterThan(0) ? ` ${formatINR(summary.unpaidExpenses)} of the expenses is not paid yet.` : ""}
            </p>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle><SectionTitle icon={BarChart3} tone="blue">Month by month</SectionTitle></CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <MonthBars
                    label="Turnover and expenses by month"
                    series={[
                      { key: "turnover", label: "Turnover", className: "bg-primary" },
                      { key: "expenses", label: "Expenses", className: "bg-info" },
                    ]}
                    months={summary.monthly.map((m) => ({ month: m.month, values: { turnover: m.turnover.toNumber(), expenses: m.expenses.toNumber() } }))}
                  />
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-bg hover:bg-bg">
                          <TableHead className={HEAD}>Month</TableHead>
                          <TableHead className={cn(HEAD, "text-right")}>Turnover</TableHead>
                          <TableHead className={cn(HEAD, "text-right")}>Received</TableHead>
                          <TableHead className={cn(HEAD, "text-right")}>Expenses</TableHead>
                          <TableHead className={cn(HEAD, "text-right")}>Profit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {summary.monthly.map((m) => (
                          <TableRow key={m.month}>
                            <TableCell>{formatDateKey(`${m.month}-01`, "MMM yyyy")}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatINR(m.turnover)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatINR(m.received)}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatINR(m.expenses)}</TableCell>
                            <TableCell className={cn("text-right font-medium tabular-nums", m.profit.isNegative() ? "text-danger" : "text-success")}>{formatINR(m.profit)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-bg font-semibold hover:bg-bg">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(summary.turnover)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(summary.received)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(summary.expenses)}</TableCell>
                          <TableCell className={cn("text-right tabular-nums", summary.profit.isNegative() ? "text-danger" : "text-success")}>{formatINR(summary.profit)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle><SectionTitle icon={ReceiptText} tone="amber">Where the money went</SectionTitle></CardTitle>
                  <p className="text-sm text-text-muted">Expenses by category</p>
                </CardHeader>
                <CardContent>
                  <PieChart
                    slices={summary.expenseByCategory.map((c) => ({ label: c.label, value: c.amount.round().toNumber() }))}
                    money
                    label="Expenses by category"
                  />
                  {can(user, "expenses.manage") ? (
                    <Button asChild variant="ghost" size="sm" className="mt-4">
                      <Link href="/admin/expenses">Open expenses</Link>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}

        {list ? (
          <Card id="payments" className="scroll-mt-6">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle><SectionTitle icon={Banknote} tone="green">Payments in this range</SectionTitle></CardTitle>
              <span className="text-sm text-text-muted">{list.total} {list.total === 1 ? "entry" : "entries"}</span>
            </CardHeader>
            <CardContent>
              {list.rows.length ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-bg hover:bg-bg">
                        <TableHead className={HEAD}>Date</TableHead>
                        <TableHead className={HEAD}>Booking</TableHead>
                        <TableHead className={cn(HEAD, "hidden md:table-cell")}>Type</TableHead>
                        <TableHead className={cn(HEAD, "hidden md:table-cell")}>Method</TableHead>
                        <TableHead className={cn(HEAD, "hidden lg:table-cell")}>Receipt / reference</TableHead>
                        <TableHead className={cn(HEAD, "text-right")}>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.rows.map((p) => {
                        const out = p.direction === "OUT";
                        return (
                          <TableRow key={p.id} className="hover:bg-blush/30">
                            <TableCell className="whitespace-nowrap">{formatDateKey(dateKey(p.occurredOn))}</TableCell>
                            <TableCell>
                              {p.booking.deletedAt ? (
                                <span className="font-medium text-text-muted">{p.booking.mainEventName} <Badge variant="secondary">Deleted booking</Badge></span>
                              ) : (
                                <Link href={`/admin/bookings/${p.booking.id}?tab=money`} className="font-medium text-text hover:text-primary">{p.booking.mainEventName}</Link>
                              )}
                              <div className="text-xs text-text-muted">{p.booking.reference}{p.booking.customer ? ` · ${p.booking.customer.fullName}` : ""}</div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <Badge variant={p.type === "PAYMENT" ? "success" : p.type === "REFUND" ? "warning" : "secondary"}>{TYPE_LABEL[p.type]}</Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">{PAYMENT_METHODS.find((m) => m.value === p.method)?.label ?? "—"}</TableCell>
                            <TableCell className="hidden text-xs text-text-muted lg:table-cell">{p.receiptNumber ?? p.transactionRef ?? "—"}</TableCell>
                            <TableCell className={cn("text-right font-medium whitespace-nowrap tabular-nums", out ? "text-danger" : "text-success")}>
                              {out ? "− " : "+ "}{formatINR(p.amount)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-text-muted">No payments recorded in this range.</p>
              )}
              {list.pageCount > 1 ? (
                <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-text-muted">Page {page} of {list.pageCount}</span>
                  <div className="flex gap-2">
                    {page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageHref(page - 1)}>Previous</Link></Button> : null}
                    {page < list.pageCount ? <Button asChild variant="outline" size="sm"><Link href={pageHref(page + 1)}>Next</Link></Button> : null}
                  </div>
                </nav>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {pies.length ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {pies.map((r) => (
              <Card key={r.key}>
                <CardHeader>
                  <CardTitle><SectionTitle icon={r.money ? HandCoins : BarChart3} tone={r.money ? "green" : "plum"}>{r.title}</SectionTitle></CardTitle>
                  <p className="text-sm text-text-muted">{r.description}</p>
                </CardHeader>
                <CardContent>
                  <PieChart slices={r.slices} money={r.money} label={r.title} />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
