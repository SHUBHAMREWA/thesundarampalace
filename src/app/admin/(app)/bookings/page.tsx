import { ClipboardList, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { nativeSelectClass } from "@/components/forms/form-kit";
import { PageHeader } from "@/components/crm/page-header";
import { BOOKING_STATUS_LABEL, BookingStatusBadge } from "@/components/crm/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { dateKey, formatDateKey } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { bookingListQuerySchema, listBookings } from "@/server/services/bookings";
import { labelOf, lookupOptions } from "@/server/services/lookups";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  const user = await requirePermission("bookings.read");
  const query = bookingListQuerySchema.parse(await searchParams);
  const [{ rows, total, pageCount }, halls, eventTypes, statusLabels] = await Promise.all([
    listBookings(user, query),
    db.hall.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    lookupOptions("event_type"),
    lookupOptions("booking_status"),
  ]);
  const filtered = Boolean(query.q || query.status || query.from || query.to || query.hallId || query.mine);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "" && k !== "page") params.set(k, String(v));
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/admin/bookings${qs ? `?${qs}` : ""}`;
  };
  const range = (start: Date | null, end: Date | null) => {
    if (!start) return "Dates to be set";
    const a = dateKey(start);
    const b = end ? dateKey(end) : a;
    return a === b ? formatDateKey(a, "EEE d MMM yyyy") : `${formatDateKey(a, "d MMM")} – ${formatDateKey(b, "d MMM yyyy")}`;
  };

  return (
    <>
      <PageHeader
        title="Bookings"
        description={`${total} ${total === 1 ? "booking" : "bookings"}${filtered ? " match" : ""}`}
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Bookings" }]}
        actions={
          can(user, "bookings.edit") ? (
            <Button asChild size="sm">
              <Link href="/admin/bookings/new"><Plus aria-hidden="true" /> New booking</Link>
            </Button>
          ) : undefined
        }
      />
      <form method="get" role="search" className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-6">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-text-muted" aria-hidden="true" />
          <label htmlFor="q" className="sr-only">Search</label>
          <Input id="q" name="q" defaultValue={query.q} placeholder="Reference, event or customer" className="bg-surface pl-9" />
        </div>
        <label htmlFor="status" className="sr-only">Status</label>
        <select id="status" name="status" defaultValue={query.status ?? ""} className={nativeSelectClass}>
          <option value="">All statuses</option>
          {Object.entries(BOOKING_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{labelOf(statusLabels, value) === value ? label : labelOf(statusLabels, value)}</option>
          ))}
        </select>
        <label htmlFor="hallId" className="sr-only">Hall</label>
        <select id="hallId" name="hallId" defaultValue={query.hallId ?? ""} className={nativeSelectClass}>
          <option value="">All halls</option>
          {halls.map((h) => (
            <option key={h.id} value={h.id}>{t(h.name, "en")}</option>
          ))}
        </select>
        <div>
          <label htmlFor="from" className="sr-only">From</label>
          <Input id="from" name="from" type="date" defaultValue={query.from} className="bg-surface" aria-label="From date" />
        </div>
        <div>
          <label htmlFor="to" className="sr-only">To</label>
          <Input id="to" name="to" type="date" defaultValue={query.to} className="bg-surface" aria-label="To date" />
        </div>
        <div className="flex items-center gap-3 md:col-span-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="mine" value="1" defaultChecked={!!query.mine} className="accent-primary" /> Only mine
          </label>
          <div className="ml-auto flex gap-2">
            {filtered ? <Button asChild variant="ghost" size="sm"><Link href="/admin/bookings">Clear filters</Link></Button> : null}
            <Button type="submit" size="sm">Apply</Button>
          </div>
        </div>
      </form>
      {rows.length ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booking</TableHead>
                <TableHead className="hidden md:table-cell">Dates</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Functions</TableHead>
                <TableHead className="hidden lg:table-cell">Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary hover:underline">{b.mainEventName}</Link>
                    <div className="text-xs text-text-muted">
                      {b.reference} · {labelOf(eventTypes, b.mainEventTypeKey)}
                      {b.customer ? ` · ${b.customer.fullName}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{range(b.startDate, b.endDate)}</TableCell>
                  <TableCell><BookingStatusBadge status={b.status} label={statusLabels.find((s) => s.value === b.status)?.label} /></TableCell>
                  <TableCell className="hidden lg:table-cell">{b._count.subEvents}</TableCell>
                  <TableCell className="hidden lg:table-cell">{b.owner?.name ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState icon={ClipboardList} title={filtered ? "No bookings match" : "No bookings yet"} description={filtered ? "Try clearing a filter." : "Create a booking from a customer or a lead."} />
      )}
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-text-muted">Page {query.page} of {pageCount}</span>
          <div className="flex gap-2">
            {query.page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageHref(query.page - 1)}>Previous</Link></Button> : null}
            {query.page < pageCount ? <Button asChild variant="outline" size="sm"><Link href={pageHref(query.page + 1)}>Next</Link></Button> : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
