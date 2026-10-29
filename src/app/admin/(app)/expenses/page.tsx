import { Receipt } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActionPanel, ConfirmAction } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import { nativeSelectClass, SelectField, TextAreaField, TextField } from "@/components/forms/form-kit";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { dateKey, formatDateKey, todayIST } from "@/lib/time";
import { createExpenseAction, deleteExpenseAction, updateExpenseAction } from "@/server/actions/operations";
import { requirePermission } from "@/server/auth/session";
import { labelOf, lookupOptions } from "@/server/services/lookups";
import { expenseListQuerySchema, listExpenses } from "@/server/services/operations";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Expenses" };

const STATUS = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTLY_PAID", label: "Partly paid" },
  { value: "PAID", label: "Paid" },
];

export default async function ExpensesPage({ searchParams }: PageProps<"/admin/expenses">) {
  const user = await requirePermission("expenses.manage");
  const query = expenseListQuerySchema.parse(await searchParams);
  const [{ rows, total, sum, pageCount }, categories, vendors, bookings] = await Promise.all([
    listExpenses(user, query),
    lookupOptions("expense_category"),
    db.vendor.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.booking.findMany({ where: { deletedAt: null, status: { not: "CANCELLED" } }, orderBy: { startDate: "desc" }, take: 200, select: { id: true, reference: true, mainEventName: true } }),
  ]);
  const bookingOptions = bookings.map((b) => ({ value: b.id, label: `${b.reference} · ${b.mainEventName}` }));
  type D = { bookingId?: string; categoryKey?: string; vendorId?: string; description?: string; amount?: string; incurredOn?: string; paymentStatus?: string; notes?: string };
  const fields = (d: D) => (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="description" label="Description" defaultValue={d.description} />
        <TextField name="amount" label="Amount (₹)" inputMode="decimal" defaultValue={d.amount} />
        <SelectField name="categoryKey" label="Category" options={categories} defaultValue={d.categoryKey ?? ""} placeholder="Choose…" />
        <TextField name="incurredOn" label="Date" type="date" defaultValue={d.incurredOn ?? todayIST()} />
        <SelectField name="bookingId" label="Booking (optional)" options={bookingOptions} defaultValue={d.bookingId ?? ""} placeholder="General expense" />
        <SelectField name="vendorId" label="Vendor (optional)" options={vendors.map((v) => ({ value: v.id, label: v.name }))} defaultValue={d.vendorId ?? ""} placeholder="—" />
        <SelectField name="paymentStatus" label="Paid?" options={STATUS} defaultValue={d.paymentStatus ?? "UNPAID"} />
      </div>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={d.notes} />
    </>
  );
  return (
    <>
      <PageHeader title="Expenses" description={`${total} expenses · ${formatINR(sum)} in this view`} crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Expenses" }]} />
      <form method="get" className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-5">
        <Input name="from" type="date" defaultValue={query.from} aria-label="From date" className="bg-surface" />
        <Input name="to" type="date" defaultValue={query.to} aria-label="To date" className="bg-surface" />
        <select name="category" defaultValue={query.category ?? ""} className={nativeSelectClass} aria-label="Category">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <Input name="booking" defaultValue={query.booking} placeholder="Booking reference" aria-label="Booking reference" className="bg-surface" />
        <div className="flex gap-2">
          <Button type="submit" size="sm">Filter</Button>
          <Button asChild variant="ghost" size="sm"><Link href="/admin/expenses">Clear</Link></Button>
        </div>
      </form>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {rows.length ? (
            rows.map((e) => (
              <details key={e.id} className="rounded-lg border border-border bg-surface p-4">
                <summary className="flex cursor-pointer flex-wrap justify-between gap-2">
                  <span>
                    <strong>{e.description}</strong> <span className="text-sm text-text-muted">· {formatDateKey(dateKey(e.incurredOn))} · {labelOf(categories, e.categoryKey)}{e.vendor ? ` · ${e.vendor.name}` : ""}{e.booking ? ` · ${e.booking.reference}` : ""}</span>
                  </span>
                  <span>{formatINR(e.amount)} <Badge variant={e.paymentStatus === "PAID" ? "success" : e.paymentStatus === "UNPAID" ? "warning" : "secondary"}>{e.paymentStatus.replace("_", " ").toLowerCase()}</Badge></span>
                </summary>
                <div className="mt-4 space-y-3">
                  <ActionPanel action={updateExpenseAction.bind(null, e.id)} submitLabel="Save">
                    {fields({ bookingId: e.bookingId ?? "", categoryKey: e.categoryKey, vendorId: e.vendorId ?? "", description: e.description, amount: e.amount.toFixed(2), incurredOn: dateKey(e.incurredOn), paymentStatus: e.paymentStatus, notes: e.notes ?? "" })}
                  </ActionPanel>
                  <ConfirmAction action={deleteExpenseAction.bind(null, e.id)} label="Remove" title="Remove this expense?" description="It disappears from lists and reports; the audit log keeps the record." reasonName="reason" reasonRequired destructive />
                </div>
              </details>
            ))
          ) : (
            <EmptyState icon={Receipt} title="No expenses in this view" />
          )}
          {pageCount > 1 ? <p className="text-sm text-text-muted">Showing page {query.page} of {pageCount}. Narrow the dates to see others.</p> : null}
        </div>
        <Card>
          <CardHeader><CardTitle>Record an expense</CardTitle></CardHeader>
          <CardContent>
            <ActionPanel action={createExpenseAction} submitLabel="Record expense" resetAfter label="Record an expense">{fields({})}</ActionPanel>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
