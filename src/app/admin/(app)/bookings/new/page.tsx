import { Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActionPanel } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import { SelectField, TextAreaField, TextField } from "@/components/forms/form-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatPhoneForDisplay } from "@/lib/contact/links";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { GST_STATES } from "@/lib/validation/gst";
import { createBookingAction } from "@/server/actions/bookings";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { searchCustomers } from "@/server/services/customers";
import { lookupOptions } from "@/server/services/lookups";

export const metadata: Metadata = { title: "New booking" };

/**
 * Create booking, step 1–2 (MASTER_PROMPT §9): find or create the customer,
 * then the main event. Functions, menus and pricing are added on the booking page.
 */
export default async function NewBookingPage({ searchParams }: PageProps<"/admin/bookings/new">) {
  const user = await requirePermission("bookings.edit");
  const params = await searchParams;
  const customerId = typeof params.customerId === "string" ? params.customerId : null;
  const leadId = typeof params.leadId === "string" ? params.leadId : "";
  const q = typeof params.q === "string" ? params.q : "";
  const customer = customerId ? await db.customer.findFirst({ where: { id: customerId, deletedAt: null } }) : null;
  const crumbs = [{ label: "Dashboard", href: "/admin" }, { label: "Bookings", href: "/admin/bookings" }, { label: "New" }];

  if (!customer) {
    const results = q ? await searchCustomers(user, q, 15) : [];
    return (
      <>
        <PageHeader title="New booking" description="Step 1 of 2 — choose the customer." crumbs={crumbs} />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <form method="get" role="search" className="flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-text-muted" aria-hidden="true" />
                <label htmlFor="q" className="sr-only">Search customers</label>
                <Input id="q" name="q" defaultValue={q} placeholder="Name, mobile or SP-C-…" className="bg-surface pl-9" autoFocus />
              </div>
              <Button type="submit">Search</Button>
            </form>
            {q ? (
              results.length ? (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {results.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <p className="font-medium">{c.fullName}</p>
                        <p className="text-xs text-text-muted">{c.reference} · {formatPhoneForDisplay(c.mobile)}{c.city ? ` · ${c.city}` : ""}</p>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/bookings/new?customerId=${c.id}`}>Choose</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">No customer matches “{q}”.</p>
              )
            ) : null}
            {can(user, "customers.edit") ? (
              <Button asChild variant="secondary">
                <Link href="/admin/customers/new?next=booking"><UserPlus aria-hidden="true" /> New customer</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </>
    );
  }

  const [eventTypes, packages, staff] = await Promise.all([
    lookupOptions("event_type"),
    db.package.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { active: true, roles: { some: { role: { permissions: { some: { permissionKey: "bookings.edit" } } } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="New booking" description={`Step 2 of 2 — main event for ${customer.fullName} (${customer.reference}).`} crumbs={crumbs} />
      <Card>
        <CardHeader><CardTitle>Main event</CardTitle></CardHeader>
        <CardContent>
          <ActionPanel action={createBookingAction} submitLabel="Create booking">
            <input type="hidden" name="customerId" value={customer.id} />
            <input type="hidden" name="leadId" value={leadId} />
            <div className="grid gap-4 md:grid-cols-2">
              <TextField name="mainEventName" label="Event name" placeholder="e.g. Sharma–Verma wedding" required />
              <SelectField name="mainEventTypeKey" label="Event type" options={eventTypes} placeholder="Choose…" />
              <TextField name="expectedGuests" label="Expected guests" type="number" min={1} />
              <SelectField name="packageId" label="Package (optional)" options={packages.map((p) => ({ value: p.id, label: t(p.name, "en") }))} placeholder="—" />
              <SelectField name="ownerId" label="Handled by" options={staff.map((s) => ({ value: s.id, label: s.name }))} defaultValue={user.id} />
              <SelectField
                name="placeOfSupplyStateCode"
                label="Place of supply (GST state)"
                options={GST_STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))}
                defaultValue={customer.stateCode ?? ""}
                placeholder="—"
              />
              <TextField name="depositRequired" label="Security deposit (₹, optional)" inputMode="decimal" />
              <SelectField
                name="initialStatus"
                label="Start as"
                options={[
                  ...(can(user, "holds.place") ? [{ value: "ENQUIRY_HOLD", label: "Enquiry hold (holds the dates for a limited time)" }] : []),
                  { value: "TENTATIVE", label: "Tentative (no expiry, warnings only)" },
                ]}
              />
            </div>
            <TextAreaField name="notes" label="Notes (shown on documents when ticked)" rows={2} />
            <TextAreaField name="internalInstructions" label="Internal instructions (staff only)" rows={2} />
          </ActionPanel>
        </CardContent>
      </Card>
    </>
  );
}
