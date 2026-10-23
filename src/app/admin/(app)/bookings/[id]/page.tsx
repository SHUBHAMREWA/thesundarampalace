import { MessageCircle, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/crm/page-header";
import { BookingStatusBadge } from "@/components/crm/status-badge";
import { Timeline } from "@/components/crm/timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { telLink, whatsappLink } from "@/lib/contact/links";
import { dateKey, formatDateKey } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { activityTimeline } from "@/server/services/activity";
import { getBookingDetail } from "@/server/services/bookings";
import { NotFoundError } from "@/server/services/leads";
import { lookupOptions } from "@/server/services/lookups";

import { DocumentsTab } from "./documents-tab";
import { MoneyTab } from "./money-tab";
import { Overview } from "./overview";
import { QuotationsTab } from "./quotations-tab";

export const metadata: Metadata = { title: "Booking" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function BookingPage({ params, searchParams }: PageProps<"/admin/bookings/[id]">) {
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
    { key: "quotations", label: "Quotations", show: can(user, "quotations.create") || can(user, "payments.read") },
    { key: "money", label: "Payments and invoices", show: can(user, "payments.read") },
    { key: "documents", label: "Documents", show: can(user, "pdf.quotation") || can(user, "pdf.financial") || can(user, "pdf.function_sheet") || can(user, "pdf.kitchen_sheet") },
    { key: "activity", label: "Activity", show: true },
  ].filter((t) => t.show);
  const tab = tabs.find((t) => t.key === one(query.tab))?.key ?? "overview";
  const statusLabels = await lookupOptions("booking_status");
  const dates = booking.startDate
    ? dateKey(booking.startDate) === dateKey(booking.endDate ?? booking.startDate)
      ? formatDateKey(booking.startDate, "EEE d MMM yyyy")
      : `${formatDateKey(booking.startDate, "d MMM")} – ${formatDateKey(booking.endDate!, "d MMM yyyy")}`
    : "Dates to be set";

  return (
    <>
      <PageHeader
        title={booking.mainEventName}
        description={`${booking.reference} · ${dates}${booking.customer ? ` · ${booking.customer.fullName}` : ""}`}
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Bookings", href: "/admin/bookings" }, { label: booking.reference }]}
        actions={
          <>
            <BookingStatusBadge status={booking.status} label={statusLabels.find((s) => s.value === booking.status)?.label} />
            {booking.customer ? (
              <>
                <Button asChild variant="outline" size="sm"><a href={telLink(booking.customer.mobile)}><Phone aria-hidden="true" /> Call</a></Button>
                <Button asChild variant="outline" size="sm"><a href={whatsappLink(booking.customer.mobile)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a></Button>
                <Button asChild variant="outline" size="sm"><Link href={`/admin/customers/${booking.customer.id}`}>Customer</Link></Button>
              </>
            ) : null}
          </>
        }
      />
      <nav aria-label="Booking sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/bookings/${booking.id}${t.key === "overview" ? "" : `?tab=${t.key}`}`}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${t.key === tab ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "overview" ? <Overview booking={booking} user={user} /> : null}
      {tab === "quotations" ? <QuotationsTab booking={booking} user={user} selectedId={one(query.v)} /> : null}
      {tab === "money" ? <MoneyTab booking={booking} user={user} /> : null}
      {tab === "documents" ? <DocumentsTab booking={booking} user={user} initialType={one(query.type) ?? null} initialSource={one(query.source) ?? null} /> : null}
      {tab === "activity" ? (
        <Card>
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardContent><Timeline entries={await activityTimeline("booking", booking.id)} /></CardContent>
        </Card>
      ) : null}
    </>
  );
}
