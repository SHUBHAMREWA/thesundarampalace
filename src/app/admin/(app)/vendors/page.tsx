import { Store } from "lucide-react";
import type { Metadata } from "next";

import { ActionPanel } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/forms/form-kit";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhoneForDisplay, telLink } from "@/lib/contact/links";
import { saveVendorAction } from "@/server/actions/operations";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { labelOf, lookupOptions } from "@/server/services/lookups";
import { listVendors } from "@/server/services/operations";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage({ searchParams }: PageProps<"/admin/vendors">) {
  const user = await requirePermission("vendors.read");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const [vendors, categories] = await Promise.all([listVendors(user, { q, includeInactive: can(user, "vendors.manage") }), lookupOptions("vendor_category")]);
  const manage = can(user, "vendors.manage");
  type Defaults = { name?: string; categoryKey?: string; contactName?: string; phone?: string; email?: string; partner?: boolean; notes?: string; active?: boolean };
  const form = (id: string | null, d: Defaults) => (
    <ActionPanel action={saveVendorAction.bind(null, id)} submitLabel={id ? "Save" : "Add vendor"} resetAfter={!id}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField name="name" label="Name" defaultValue={d.name} />
        <SelectField name="categoryKey" label="Category" options={categories} defaultValue={d.categoryKey ?? ""} placeholder="Choose…" />
        <TextField name="contactName" label="Contact person" defaultValue={d.contactName} />
        <TextField name="phone" label="Phone" type="tel" defaultValue={d.phone} />
        <TextField name="email" label="Email" type="email" defaultValue={d.email} />
      </div>
      <TextAreaField name="notes" label="Notes" rows={2} defaultValue={d.notes} />
      <CheckboxField name="partner" label="Partner vendor (recommended to customers)" defaultChecked={d.partner} />
      <CheckboxField name="active" label="Active" defaultChecked={d.active ?? true} />
    </ActionPanel>
  );
  return (
    <>
      <PageHeader title="Vendors" description="Décor, photography, DJ and other partners. Assign them to bookings from the booking's Team tab." crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Vendors" }]} />
      <form method="get" role="search" className="mb-4 flex max-w-md gap-2">
        <label htmlFor="q" className="sr-only">Search vendors</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name" className="h-9 flex-1 rounded-md border border-input bg-surface px-3 text-sm" />
      </form>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {vendors.length ? (
            vendors.map((v) => (
              <details key={v.id} className="rounded-lg border border-border bg-surface p-4">
                <summary className="cursor-pointer">
                  <strong>{v.name}</strong> <span className="text-sm text-text-muted">· {labelOf(categories, v.categoryKey)} · {v._count.assignments} events</span>{" "}
                  {v.partner ? <Badge variant="info">partner</Badge> : null} {v.active ? null : <Badge variant="secondary">inactive</Badge>}
                </summary>
                <div className="mt-3 space-y-3 text-sm">
                  <p>
                    {v.contactName ?? "—"}
                    {v.phone ? <> · <a href={telLink(v.phone)} className="text-primary hover:underline">{formatPhoneForDisplay(v.phone)}</a></> : null}
                    {v.email ? ` · ${v.email}` : ""}
                  </p>
                  {v.notes ? <p className="text-text-muted whitespace-pre-line">{v.notes}</p> : null}
                  {manage ? form(v.id, { name: v.name, categoryKey: v.categoryKey, contactName: v.contactName ?? "", phone: v.phone ?? "", email: v.email ?? "", partner: v.partner, notes: v.notes ?? "", active: v.active }) : null}
                </div>
              </details>
            ))
          ) : (
            <EmptyState icon={Store} title="No vendors yet" />
          )}
        </div>
        {manage ? (
          <Card>
            <CardHeader><CardTitle>Add a vendor</CardTitle></CardHeader>
            <CardContent>{form(null, {})}</CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
