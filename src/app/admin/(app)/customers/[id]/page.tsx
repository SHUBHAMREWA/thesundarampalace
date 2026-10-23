import { Download, FileLock2, MessageCircle, Phone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActionPanel, ConfirmAction, InlineAction } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import { BookingStatusBadge, LeadStatusBadge } from "@/components/crm/status-badge";
import { Detail, Timeline } from "@/components/crm/timeline";
import { SelectField, TextField } from "@/components/forms/form-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhoneForDisplay, telLink, whatsappLink } from "@/lib/contact/links";
import { dateKey, formatDateKey, formatIST } from "@/lib/time";
import { gstStateLabel } from "@/lib/validation/gst";
import {
  deleteDocumentAction,
  flagDuplicateAction,
  setConsentAction,
  updateCustomerAction,
  uploadDocumentAction,
} from "@/server/actions/customers";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { activityTimeline } from "@/server/services/activity";
import { ageOn, CONSENT_PURPOSES, DOCUMENT_CATEGORIES, getCustomer } from "@/server/services/customers";
import { NotFoundError } from "@/server/services/leads";
import { labelOf, lookupOptions } from "@/server/services/lookups";

import { CustomerForm } from "../customer-form";
import { customerFormOptions } from "../options";

export const metadata: Metadata = { title: "Customer" };

const kb = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const user = await requirePermission("customers.read");
  let data;
  try {
    data = await getCustomer(user, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { customer, documents, consents, pendingDuplicates } = data;
  const [options, statuses, timeline] = await Promise.all([customerFormOptions(), lookupOptions("lead_status"), activityTimeline("customer", id)]);
  const personal = can(user, "customers.personal.read");
  const c = customer as typeof customer & { dateOfBirth?: Date | null; anniversary?: Date | null; maritalStatus?: string | null; spouseName?: string | null; address?: string | null; locality?: string | null };
  const age = personal ? ageOn(c.dateOfBirth ?? null) : null;

  return (
    <>
      <PageHeader
        title={customer.fullName}
        description={`${customer.reference} · added ${formatIST(customer.createdAt, "d MMM yyyy")}`}
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Customers", href: "/admin/customers" }, { label: customer.reference }]}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={telLink(customer.mobile)}><Phone aria-hidden="true" /> Call</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={whatsappLink(customer.whatsapp ?? customer.mobile)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" /> WhatsApp</a>
            </Button>
            {can(user, "bookings.edit") ? (
              <Button asChild size="sm">
                <Link href={`/admin/bookings/new?customerId=${customer.id}`}><Plus aria-hidden="true" /> New booking</Link>
              </Button>
            ) : null}
          </>
        }
      />
      {pendingDuplicates ? (
        <p className="mb-4 rounded-md border border-warning/40 bg-surface p-3 text-sm text-warning">
          This customer may be a duplicate.{" "}
          {can(user, "customers.merge") ? <Link href="/admin/customers/duplicates" className="underline">Review duplicates</Link> : "A manager will review it."}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="mb-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                <Detail label="Mobile">{formatPhoneForDisplay(customer.mobile)}</Detail>
                <Detail label="Email">{customer.email}</Detail>
                <Detail label="Category">{labelOf(options.categories, customer.categoryKey)}</Detail>
                <Detail label="State">{gstStateLabel(customer.stateCode)}</Detail>
                <Detail label="GSTIN">{customer.gstin}</Detail>
                {personal ? <Detail label="Age">{age ?? "—"}</Detail> : null}
              </dl>
              {can(user, "customers.edit") ? (
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-primary">Edit details</summary>
                  <div className="mt-4">
                    <CustomerForm
                      action={updateCustomerAction.bind(null, customer.id)}
                      {...options}
                      showPersonal={personal}
                      submitLabel="Save customer"
                      defaults={{
                        fullName: customer.fullName,
                        mobile: customer.mobile,
                        whatsapp: customer.whatsapp ?? "",
                        email: customer.email ?? "",
                        gstin: customer.gstin ?? "",
                        companyName: customer.companyName ?? "",
                        categoryKey: customer.categoryKey ?? "",
                        professionKey: customer.professionKey ?? "",
                        professionOther: customer.professionOther ?? "",
                        stateCode: customer.stateCode ?? "",
                        city: customer.city ?? "",
                        notes: customer.notes ?? "",
                        maritalStatus: c.maritalStatus ?? "",
                        dateOfBirth: c.dateOfBirth ? dateKey(c.dateOfBirth) : "",
                        anniversary: c.anniversary ? dateKey(c.anniversary) : "",
                        spouseName: c.spouseName ?? "",
                        locality: c.locality ?? "",
                        address: c.address ?? "",
                      }}
                    />
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Bookings</CardTitle></CardHeader>
            <CardContent>
              {customer.bookings.length ? (
                <ul className="divide-y divide-border">
                  {customer.bookings.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-4 py-3">
                      <div>
                        {can(user, "bookings.read") ? (
                          <Link href={`/admin/bookings/${b.id}`} className="font-medium text-primary hover:underline">{b.mainEventName}</Link>
                        ) : (
                          <span className="font-medium">{b.mainEventName}</span>
                        )}
                        <p className="text-xs text-text-muted">
                          {b.reference} · {b.startDate ? formatDateKey(b.startDate) : "dates to be set"}
                        </p>
                      </div>
                      <BookingStatusBadge status={b.status} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">No bookings yet.</p>
              )}
            </CardContent>
          </Card>

          {customer.leads.length ? (
            <Card>
              <CardHeader><CardTitle>Enquiries</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {customer.leads.map((l) => {
                    const status = statuses.find((s) => s.value === l.statusKey);
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-4 py-3">
                        <div>
                          {can(user, "leads.read") ? <Link href={`/admin/leads/${l.id}`} className="font-medium text-primary hover:underline">{l.reference}</Link> : l.reference}
                          <p className="text-xs text-text-muted">{formatIST(l.createdAt, "d MMM yyyy")}</p>
                        </div>
                        <LeadStatusBadge label={status?.label ?? l.statusKey} systemKey={status?.systemKey} statusKey={l.statusKey} />
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent><Timeline entries={timeline} /></CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {documents ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileLock2 className="size-4" aria-hidden="true" /> Private documents</CardTitle>
                <p className="text-sm text-text-muted">Stored privately. Every view is recorded. Prefer masked Aadhaar copies.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {documents.length ? (
                  <ul className="divide-y divide-border text-sm">
                    {documents.map((d) => (
                      <li key={d.id} className="flex items-start justify-between gap-3 py-2">
                        <div className="min-w-0">
                          <p className="font-medium">{DOCUMENT_CATEGORIES.find((x) => x.value === d.category)?.label ?? d.category}{d.label ? ` — ${d.label}` : ""}</p>
                          <p className="text-xs text-text-muted">{d.fileName} · {kb(d.sizeBytes)} · {formatIST(d.createdAt, "d MMM yyyy")}{d.partyId ? " · bride/groom" : ""}</p>
                          {d.purpose ? <p className="text-xs text-text-muted">Purpose: {d.purpose}</p> : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/api/private-files/${d.id}`} aria-label={`Download ${d.fileName}`}><Download aria-hidden="true" /></a>
                          </Button>
                          {can(user, "documents.sensitive.upload") ? (
                            <ConfirmAction
                              action={deleteDocumentAction.bind(null, customer.id, d.id)}
                              label="Delete"
                              title="Delete this document?"
                              description="The file is removed from storage. A record that it existed (and who deleted it) is kept."
                              reasonName="reason"
                              reasonRequired
                              destructive
                            />
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-text-muted">No documents.</p>
                )}
                {can(user, "documents.sensitive.upload") ? (
                  <ActionPanel action={uploadDocumentAction.bind(null, customer.id)} submitLabel="Upload privately" resetAfter>
                    <SelectField name="category" label="Type" options={DOCUMENT_CATEGORIES.map((d) => ({ value: d.value, label: d.label }))} placeholder="Choose…" />
                    <TextField name="label" label="Label (optional)" />
                    <TextField name="purpose" label="Why is this needed?" required />
                    <TextField name="file" label="File (JPEG, PNG, WebP or PDF)" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required />
                  </ActionPanel>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Communication consent</CardTitle>
              <p className="text-sm text-text-muted">Record only what the customer actually agreed to. Booking messages don&apos;t need this.</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {CONSENT_PURPOSES.map((p) => {
                  const record = consents.get(p.value);
                  return (
                    <li key={p.value} className="flex items-center justify-between gap-3">
                      <div>
                        <p>{p.label}</p>
                        <p className="text-xs text-text-muted">{record ? `${record.granted ? "Opted in" : "Opted out"} ${formatIST(record.createdAt, "d MMM yyyy")}` : "Not asked"}</p>
                      </div>
                      {can(user, "customers.edit") ? (
                        <InlineAction action={setConsentAction.bind(null, customer.id)} fields={{ purpose: p.value, granted: record?.granted ? "false" : "true" }} variant="outline" size="sm">
                          {record?.granted ? "Record opt-out" : "Record opt-in"}
                        </InlineAction>
                      ) : (
                        <Badge variant={record?.granted ? "success" : "secondary"}>{record?.granted ? "Yes" : "No"}</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {can(user, "customers.edit") ? (
            <Card>
              <CardHeader><CardTitle>Same person as another record?</CardTitle></CardHeader>
              <CardContent>
                <ActionPanel action={flagDuplicateAction.bind(null, customer.id)} submitLabel="Send for review" resetAfter>
                  <TextField name="otherId" label="Other customer's reference" placeholder="SP-C-2026-00012" />
                </ActionPanel>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
