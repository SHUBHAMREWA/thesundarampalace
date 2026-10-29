import { ChevronRight, Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActionPanel } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import {
  PersonAvatar,
  TonePill,
  toneFor,
} from "@/components/crm/person-avatar";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/forms/form-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPhoneForDisplay } from "@/lib/contact/links";
import { db } from "@/lib/db";
import { createBookingAction } from "@/server/actions/bookings";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { customerPicker } from "@/server/services/customers";
import { PAYMENT_METHODS } from "@/server/services/money";
import { todayIST } from "@/lib/time";
import { labelOf, lookupOptions } from "@/server/services/lookups";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "New booking" };

/**
 * Create booking, step 1–2 (MASTER_PROMPT §9): find or create the customer,
 * then the main event. Functions, menus and pricing are added on the booking page.
 */
export default async function NewBookingPage({
  searchParams,
}: PageProps<"/admin/bookings/new">) {
  const user = await requirePermission("bookings.edit");
  const params = await searchParams;
  const customerId =
    typeof params.customerId === "string" ? params.customerId : null;
  const leadId = typeof params.leadId === "string" ? params.leadId : "";
  const q = typeof params.q === "string" ? params.q : "";
  const customer = customerId
    ? await db.customer.findFirst({
        where: { id: customerId, deletedAt: null },
      })
    : null;
  const crumbs = [
    { label: "Dashboard", href: "/admin" },
    { label: "Bookings", href: "/admin/bookings" },
    { label: "New" },
  ];

  if (!customer) {
    const [results, categories] = await Promise.all([
      customerPicker(user, q, q ? 30 : 20),
      lookupOptions("customer_category"),
    ]);
    return (
      <>
        <PageHeader
          title="New booking"
          description="Step 1 of 2 — choose the customer."
          crumbs={crumbs}
        />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form method="get" role="search" className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-2.5 left-3 size-4 text-text-muted"
                  aria-hidden="true"
                />
                <label htmlFor="q" className="sr-only">
                  Search customers
                </label>
                <Input
                  id="q"
                  name="q"
                  defaultValue={q}
                  placeholder="Name, mobile or SP-C-…"
                  className="bg-surface pl-9"
                  autoFocus
                />
              </div>
              <Button type="submit">Search</Button>
            </form>
            <h2 className="text-sm font-semibold text-text-muted">
              {q
                ? `Customers matching “${q}”`
                : "Recent customers — choose one, or search above"}
            </h2>
            {results.length ? (
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/admin/bookings/new?customerId=${c.id}${leadId ? `&leadId=${leadId}` : ""}`}
                      className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-primary hover:bg-blush/30 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <PersonAvatar name={c.fullName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium group-hover:text-primary">
                          {c.fullName}
                        </p>
                        <p className="truncate text-xs text-text-muted">
                          {formatPhoneForDisplay(c.mobile)}
                          {c.city ? ` · ${c.city}` : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.categoryKey ? (
                            <TonePill tone={toneFor(c.categoryKey)}>
                              {labelOf(categories, c.categoryKey)}
                            </TonePill>
                          ) : null}
                          <TonePill tone={c._count.bookings ? "green" : "plum"}>
                            {c._count.bookings}{" "}
                            {c._count.bookings === 1 ? "booking" : "bookings"}
                          </TonePill>
                        </div>
                      </div>
                      <ChevronRight
                        className="size-4 shrink-0 text-text-muted group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">
                {q ? `No customer matches “${q}”.` : "No customers yet."}
              </p>
            )}
            {can(user, "customers.edit") ? (
              <Button asChild variant="secondary">
                <Link href="/admin/customers/new?next=booking">
                  <UserPlus aria-hidden="true" /> New customer
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </>
    );
  }

  // The person who creates the booking owns it (who sees it, who gets its reminders).
  const eventTypes = await lookupOptions("event_type");
  return (
    <>
      <PageHeader
        title="New booking"
        description={`Step 2 of 2 — main event for ${customer.fullName} (${customer.reference}).`}
        crumbs={crumbs}
      />
      <Card>
        <CardHeader>
          <CardTitle>Main event</CardTitle>
        </CardHeader>
        <CardContent>
          <ActionPanel
            action={createBookingAction}
            submitLabel="Create booking"
            money
          >
            <input type="hidden" name="customerId" value={customer.id} />
            <input type="hidden" name="leadId" value={leadId} />
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                name="bookedOn"
                label="Booking date (the day it was booked)"
                type="date"
                defaultValue={todayIST()}
                max={todayIST()}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  name="eventFrom"
                  label="Event from"
                  type="date"
                  required
                />
                <TextField
                  name="eventTo"
                  label="Event to"
                  type="date"
                  hint="Leave empty for one day."
                />
              </div>
              <TextField
                name="mainEventName"
                label="Event name"
                placeholder="e.g. Sharma–Verma wedding"
                required
              />
              <SelectField
                name="mainEventTypeKey"
                label="Event type"
                options={eventTypes}
                placeholder="Choose…"
              />
              <TextField
                name="expectedGuests"
                label="Expected guests"
                type="number"
                min={1}
              />
            </div>
            <div className="grid gap-4 rounded-lg border border-border bg-bg p-4 md:grid-cols-3">
              <TextField
                name="bookingAmount"
                label="Booking amount (₹)"
                inputMode="decimal"
                placeholder="e.g. 350000"
                hint="What the booking is agreed for."
                required
              />
              {can(user, "payments.create") ? (
                <>
                  <TextField
                    name="advanceAmount"
                    label="Advance taken now (₹)"
                    inputMode="decimal"
                    placeholder="0"
                    hint="Recorded as the first payment, dated today."
                  />
                  <SelectField
                    name="advanceMethod"
                    label="Advance paid by"
                    options={PAYMENT_METHODS.map((m) => ({
                      value: m.value,
                      label: m.label,
                    }))}
                    defaultValue="CASH"
                  />
                </>
              ) : null}
            </div>
            <TextAreaField
              name="notes"
              label="Notes (shown on documents when ticked)"
              rows={2}
            />
            <TextAreaField
              name="internalInstructions"
              label="Internal instructions (staff only)"
              rows={2}
            />
          </ActionPanel>
        </CardContent>
      </Card>
    </>
  );
}
