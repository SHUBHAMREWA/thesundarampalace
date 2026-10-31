import { Activity, Phone, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmAction } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import { SectionTitle } from "@/components/crm/person-avatar";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { BookingStatusBadge } from "@/components/crm/status-badge";
import { Timeline } from "@/components/crm/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { telLink, whatsappLink } from "@/lib/contact/links";
import { dateKey, formatDateKey } from "@/lib/time";
import { cn } from "@/lib/utils";
import {
  deleteBookingAction,
} from "@/server/actions/bookings";
import { requirePermission } from "@/server/auth/session";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { activityTimeline } from "@/server/services/activity";
import { getBookingFoodMenu, menuImages } from "@/server/services/food-menu";
import {
  bookingDeleteBlocker,
  getBookingDetail,
} from "@/server/services/bookings";
import { NotFoundError } from "@/server/services/leads";
import { lookupOptions } from "@/server/services/lookups";

import { BookingFoodMenu } from "./booking-food-menu";
import { DocumentsTab } from "./documents-tab";
import { MoneyTab } from "./money-tab";
import { Overview } from "./overview";
import { QuotationsTab } from "./quotations-tab";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Booking" };

const one = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : undefined;

export default async function BookingPage({
  params,
  searchParams,
}: PageProps<"/admin/bookings/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requirePermission("bookings.read");
  let booking;
  try {
    booking = await getBookingDetail(user, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const tabs = [
    { key: "overview", label: "Overview", show: true },
    {
      key: "quotations",
      label: "Quotations",
      show: can(user, "quotations.create") || can(user, "payments.read"),
    },
    {
      key: "money",
      label: "Payments and invoices",
      show: can(user, "payments.read"),
    },
    {
      key: "documents",
      label: "Documents",
      show:
        can(user, "pdf.quotation") ||
        can(user, "pdf.financial") ||
        can(user, "pdf.function_sheet") ||
        can(user, "pdf.menu"),
    },
    { key: "activity", label: "Activity", show: true },
    { key: "food-menu", label: "Food menu", show: true },
  ].filter((t) => t.show);
  const tab = tabs.find((t) => t.key === one(query.tab))?.key ?? "overview";
  const statusLabels = await lookupOptions("booking_status");
  const deleteBlocker = can(user, "bookings.delete")
    ? await bookingDeleteBlocker(booking.id, booking.status)
    : null;
  const dates = booking.startDate
    ? dateKey(booking.startDate) ===
      dateKey(booking.endDate ?? booking.startDate)
      ? formatDateKey(booking.startDate, "EEE d MMM yyyy")
      : `${formatDateKey(booking.startDate, "d MMM")} – ${formatDateKey(booking.endDate!, "d MMM yyyy")}`
    : "Dates to be set";

  return (
    <>
      <PageHeader
        title={booking.mainEventName}
        description={`${booking.reference} · ${dates}${booking.customer ? ` · ${booking.customer.fullName}` : ""}`}
        crumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Bookings", href: "/admin/bookings" },
          { label: booking.reference },
        ]}
        actions={
          <>
            <BookingStatusBadge
              status={booking.status}
              label={
                statusLabels.find((s) => s.value === booking.status)?.label
              }
            />
            {booking.customer ? (
              <>
                <Button asChild variant="outline" size="sm">
                  <a href={telLink(booking.customer.mobile)}>
                    <Phone aria-hidden="true" /> Call
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a
                    href={whatsappLink(booking.customer.mobile)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <WhatsAppIcon className="text-whatsapp" /> WhatsApp
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/customers/${booking.customer.id}`}>
                    Customer
                  </Link>
                </Button>
              </>
            ) : null}

            {can(user, "bookings.delete") ? (
              deleteBlocker ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title={deleteBlocker}
                  className="text-danger"
                >
                  <Trash2 aria-hidden="true" /> Delete
                </Button>
              ) : (
                <ConfirmAction
                  action={deleteBookingAction.bind(null, booking.id)}
                  label="Delete"
                  triggerContent={
                    <>
                      <Trash2 aria-hidden="true" /> Delete
                    </>
                  }
                  triggerVariant="outline"
                  triggerClassName="border-danger/40 text-danger hover:bg-danger/10"
                  title={`Delete ${booking.mainEventName} (${booking.reference})?`}
                  description="The booking disappears from the CRM and its halls become free again. The audit log keeps who deleted it and why."
                  confirmLabel="Delete booking"
                  reasonName="reason"
                  reasonLabel="Why?"
                  reasonRequired
                  destructive
                />
              )
            ) : null}
          </>
        }
      />
      <nav
        aria-label="Booking sections"
        className="mb-6 flex gap-1.5 overflow-x-auto rounded-full border border-border bg-surface p-1 shadow-[var(--shadow-card)] sm:w-fit"
      >
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/bookings/${booking.id}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              t.key === tab
                ? "bg-primary text-primary-foreground"
                : "text-text-muted hover:bg-blush/50 hover:text-text",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "overview" ? <Overview booking={booking} user={user} /> : null}
      {tab === "quotations" ? (
        <QuotationsTab
          booking={booking}
          user={user}
        />
      ) : null}
      {tab === "money" ? <MoneyTab booking={booking} user={user} /> : null}
      {tab === "documents" ? (
        <DocumentsTab
          booking={booking}
          user={user}
          initialType={one(query.type) ?? null}
          initialSource={one(query.source) ?? null}
        />
      ) : null}
      {tab === "food-menu" ? (
        <BookingFoodMenuTab bookingId={booking.id} user={user} />
      ) : null}
      {tab === "activity" ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <SectionTitle icon={Activity} tone="plum">
                Activity
              </SectionTitle>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline entries={await activityTimeline("booking", booking.id)} />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}

/** This booking's own food menu (a copy of the venue menu with the items picked for it). */
async function BookingFoodMenuTab({
  bookingId,
  user,
}: {
  bookingId: string;
  user: CurrentUser;
}) {
  const { menu, saved } = await getBookingFoodMenu(user, bookingId);
  // Changes whenever the saved menu changes, so the editor and preview reload.
  let hash = 0;
  for (const ch of JSON.stringify(menu)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const version = saved ? (hash >>> 0).toString(36) : "new";
  return (
    <BookingFoodMenu
      key={version}
      bookingId={bookingId}
      initial={menu}
      saved={saved}
      images={menuImages()}
      canEdit={can(user, "bookings.edit")}
    />
  );
}
