import {
  CalendarDays,
  CalendarHeart,
  ClipboardList,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmAction } from "@/components/crm/action-kit";
import { IconChip, TONES, type Tone } from "@/components/crm/icon-chip";
import { nativeSelectClass } from "@/components/forms/form-kit";
import { PageHeader } from "@/components/crm/page-header";
import { TonePill, toneFor } from "@/components/crm/person-avatar";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import {
  BOOKING_STATUS_LABEL,
  BookingStatusBadge,
} from "@/components/crm/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { whatsappLink } from "@/lib/contact/links";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { dateKey, formatDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import { deleteBookingAction } from "@/server/actions/bookings";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import {
  bookingListQuerySchema,
  bookingStatusCounts,
  listBookings,
} from "@/server/services/bookings";
import { labelOf, lookupOptions } from "@/server/services/lookups";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Bookings" };

/** Round, tinted icon button for table rows (same as Customers). */
const ROW_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-full transition-colors";

/** Status → chip colour, matching the status badges. */
const STATUS_TONE: Record<string, Tone> = {
  ENQUIRY_HOLD: "blue",
  TENTATIVE: "amber",
  QUOTATION_SENT: "plum",
  CONFIRMED: "green",
  IN_PROGRESS: "rose",
  COMPLETED: "gold",
  CANCELLED: "red",
};

/** Statuses a booking can be deleted from (the server also refuses bookings with money on record). */
const DELETABLE = new Set([
  "ENQUIRY_HOLD",
  "TENTATIVE",
  "QUOTATION_SENT",
  "CANCELLED",
]);

export default async function BookingsPage({
  searchParams,
}: PageProps<"/admin/bookings">) {
  const user = await requirePermission("bookings.read");
  const query = bookingListQuerySchema.parse(await searchParams);
  const [{ rows, total, pageCount }, counts, halls, eventTypes, statusLabels] =
    await Promise.all([
      listBookings(user, query),
      bookingStatusCounts(user),
      db.hall.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      }),
      lookupOptions("event_type"),
      lookupOptions("booking_status"),
    ]);
  const canDelete = can(user, "bookings.delete");
  const statusLabel = (value: string) =>
    statusLabels.find((s) => s.value === value)?.label ??
    BOOKING_STATUS_LABEL[value] ??
    value;
  const allCount = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const filtered = Boolean(
    query.q || query.status || query.from || query.to || query.hallId,
  );
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query))
      if (v !== undefined && v !== "" && k !== "page") params.set(k, String(v));
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/admin/bookings${qs ? `?${qs}` : ""}`;
  };
  const range = (start: Date | null, end: Date | null) => {
    if (!start) return "Dates to be set";
    const a = dateKey(start);
    const b = end ? dateKey(end) : a;
    return a === b
      ? formatDateKey(a, "EEE d MMM yyyy")
      : `${formatDateKey(a, "d MMM")} – ${formatDateKey(b, "d MMM yyyy")}`;
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
              <Link href="/admin/bookings/new">
                <Plus aria-hidden="true" /> New booking
              </Link>
            </Button>
          ) : undefined
        }
      />
      <nav
        aria-label="Bookings by status"
        className="mb-4 flex flex-wrap gap-2"
      >
        <Link
          href="/admin/bookings"
          aria-current={!query.status ? "page" : undefined}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            !query.status
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface hover:bg-blush/40",
          )}
        >
          All <span className="text-xs opacity-80">{allCount}</span>
        </Link>
        {Object.keys(BOOKING_STATUS_LABEL)
          .filter((s) => counts[s as keyof typeof counts])
          .map((s) => (
            <Link
              key={s}
              href={`/admin/bookings?status=${s}`}
              aria-current={query.status === s ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                TONES[STATUS_TONE[s] ?? "rose"],
                query.status === s
                  ? "border-current"
                  : "border-transparent hover:border-current",
              )}
            >
              {statusLabel(s)}{" "}
              <span className="rounded-full bg-surface px-1.5 text-xs">
                {counts[s as keyof typeof counts]}
              </span>
            </Link>
          ))}
      </nav>
      <form
        method="get"
        role="search"
        className="mb-6 grid gap-3 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow-card)] md:grid-cols-6"
      >
        <div className="relative md:col-span-2">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 size-4 text-text-muted"
            aria-hidden="true"
          />
          <label htmlFor="q" className="sr-only">
            Search
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={query.q}
            placeholder="Reference, event or customer"
            className="bg-surface pl-9"
          />
        </div>
        <label htmlFor="status" className="sr-only">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={query.status ?? ""}
          className={nativeSelectClass}
        >
          <option value="">All statuses</option>
          {Object.entries(BOOKING_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {labelOf(statusLabels, value) === value
                ? label
                : labelOf(statusLabels, value)}
            </option>
          ))}
        </select>
        <label htmlFor="hallId" className="sr-only">
          Hall
        </label>
        <select
          id="hallId"
          name="hallId"
          defaultValue={query.hallId ?? ""}
          className={nativeSelectClass}
        >
          <option value="">All halls</option>
          {halls.map((h) => (
            <option key={h.id} value={h.id}>
              {t(h.name, "en")}
            </option>
          ))}
        </select>
        <div>
          <label htmlFor="from" className="sr-only">
            From
          </label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={query.from}
            className="bg-surface"
            aria-label="From date"
          />
        </div>
        <div>
          <label htmlFor="to" className="sr-only">
            To
          </label>
          <Input
            id="to"
            name="to"
            type="date"
            defaultValue={query.to}
            className="bg-surface"
            aria-label="To date"
          />
        </div>
        <div className="flex items-center gap-3 md:col-span-6">
          <div className="ml-auto flex gap-2">
            {filtered ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/bookings">Clear filters</Link>
              </Button>
            ) : null}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </div>
      </form>
      {rows.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-bg hover:bg-bg">
                <TableHead className="text-xs tracking-wide text-text-muted uppercase">
                  Booking
                </TableHead>
                <TableHead className="hidden text-xs tracking-wide text-text-muted uppercase md:table-cell">
                  Dates
                </TableHead>
                <TableHead className="text-xs tracking-wide text-text-muted uppercase">
                  Status
                </TableHead>
                <TableHead className="hidden text-xs tracking-wide text-text-muted uppercase lg:table-cell">
                  Functions
                </TableHead>
                <TableHead className="text-right text-xs tracking-wide text-text-muted uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id} className="hover:bg-blush/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <IconChip
                        icon={CalendarHeart}
                        tone={STATUS_TONE[b.status] ?? "rose"}
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="font-medium text-text hover:text-primary"
                        >
                          {b.mainEventName}
                        </Link>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-muted">
                          <span>{b.reference}</span>
                          {b.mainEventTypeKey ? (
                            <TonePill tone={toneFor(b.mainEventTypeKey)}>
                              {labelOf(eventTypes, b.mainEventTypeKey)}
                            </TonePill>
                          ) : null}
                          {b.customer ? (
                            <span>· {b.customer.fullName}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5",
                        b.startDate ? "text-text" : "text-text-muted italic",
                      )}
                    >
                      <CalendarDays
                        className={cn(
                          "size-4",
                          b.startDate ? "text-info" : "text-text-muted",
                        )}
                        aria-hidden="true"
                      />
                      {range(b.startDate, b.endDate)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <BookingStatusBadge
                      status={b.status}
                      label={statusLabel(b.status)}
                    />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <TonePill tone={b._count.subEvents ? "green" : "plum"}>
                      {b._count.subEvents}
                    </TonePill>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {b.customer ? (
                        <a
                          href={whatsappLink(
                            b.customer.whatsapp || b.customer.mobile,
                            `Namaste ${b.customer.fullName.split(" ")[0]},`,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Chat with ${b.customer.fullName} on WhatsApp`}
                          title="Chat on WhatsApp"
                          className={cn(
                            ROW_BUTTON,
                            "bg-whatsapp/10 text-whatsapp hover:bg-whatsapp/20",
                          )}
                        >
                          <WhatsAppIcon className="size-4" />
                        </a>
                      ) : null}
                      {canDelete && !DELETABLE.has(b.status) ? (
                        <span
                          className={cn(
                            ROW_BUTTON,
                            "cursor-not-allowed bg-danger/5 text-danger/40",
                          )}
                          role="img"
                          aria-label={`Can't delete ${b.mainEventName}: ${statusLabel(b.status).toLowerCase()}`}
                          title="Confirmed, running or completed bookings can't be deleted. Open the booking and click Un-confirm first."
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </span>
                      ) : null}
                      {canDelete && DELETABLE.has(b.status) ? (
                        <ConfirmAction
                          action={deleteBookingAction.bind(null, b.id)}
                          label={`Delete ${b.mainEventName}`}
                          triggerContent={
                            <Trash2 className="size-4" aria-hidden="true" />
                          }
                          triggerClassName={cn(
                            ROW_BUTTON,
                            "bg-danger/10 p-0 text-danger hover:bg-danger/20",
                          )}
                          title={`Delete ${b.mainEventName} (${b.reference})?`}
                          description="The booking disappears from the CRM and its halls become free again. The audit log keeps who deleted it and why. If money was received, refund it first so the balance is ₹0; the payment records stay for the accounts."
                          confirmLabel="Delete booking"
                          reasonName="reason"
                          reasonLabel="Why?"
                          reasonRequired
                          destructive
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title={filtered ? "No bookings match" : "No bookings yet"}
          description={
            filtered
              ? "Try clearing a filter."
              : "Create a booking from a customer or a lead."
          }
        />
      )}
      {pageCount > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-6 flex items-center justify-between text-sm"
        >
          <span className="text-text-muted">
            Page {query.page} of {pageCount}
          </span>
          <div className="flex gap-2">
            {query.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(query.page - 1)}>Previous</Link>
              </Button>
            ) : null}
            {query.page < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(query.page + 1)}>Next</Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
