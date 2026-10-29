import {
  CalendarDays,
  Copy,
  Download,
  FileLock2,
  FileText,
  History,
  Inbox,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ActionPanel,
  ConfirmAction,
  InlineAction,
} from "@/components/crm/action-kit";
import { ImageViewer } from "@/components/crm/image-viewer";
import { PageHeader } from "@/components/crm/page-header";
import {
  PersonAvatar,
  SectionTitle,
  TonePill,
  toneFor,
} from "@/components/crm/person-avatar";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import {
  BookingStatusBadge,
  LeadStatusBadge,
} from "@/components/crm/status-badge";
import { Detail, Timeline } from "@/components/crm/timeline";
import { WhatsAppHistory } from "@/components/crm/whatsapp-history";
import { CompressedFileField } from "@/components/forms/compressed-file-field";
import { SelectField, TextField } from "@/components/forms/form-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatPhoneForDisplay,
  telLink,
  whatsappLink,
} from "@/lib/contact/links";
import { dateKey, formatDateKey, formatIST } from "@/lib/time";
import {
  changePhotoAction,
  deleteDocumentAction,
  flagDuplicateAction,
  setConsentAction,
  updateCustomerAction,
  uploadDocumentAction,
} from "@/server/actions/customers";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { activityTimeline } from "@/server/services/activity";
import { messageHistory } from "@/server/services/whatsapp/campaigns";
import { customerPhotoUrl } from "@/server/services/customer-photo";
import {
  CONSENT_PURPOSES,
  customerAge,
  DOCUMENT_CATEGORIES,
  getCustomer,
} from "@/server/services/customers";
import { NotFoundError } from "@/server/services/leads";
import { labelOf, lookupOptions } from "@/server/services/lookups";

import { CustomerForm } from "../customer-form";
import { customerFormOptions } from "../options";
import { AvatarPhoto } from "./avatar-photo";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Customer" };

const kb = (bytes: number) =>
  bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;

export default async function CustomerPage({
  params,
  searchParams,
}: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  const openEdit = (await searchParams).edit === "1";
  const user = await requirePermission("customers.read");
  let data;
  try {
    data = await getCustomer(user, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { customer, documents, consents, pendingDuplicates } = data;
  const [options, statuses, timeline, whatsapp] = await Promise.all([
    customerFormOptions(),
    lookupOptions("lead_status"),
    activityTimeline("customer", id),
    messageHistory(user, "customer", id),
  ]);
  const personal = can(user, "customers.personal.read");
  const c = customer as typeof customer &
    Partial<
      Pick<
        typeof customer,
        | "dateOfBirth"
        | "approxBirthYear"
        | "anniversary"
        | "maritalStatus"
        | "spouseName"
        | "address"
        | "locality"
        | "mapsUrl"
        | "photoKey"
      >
    >;
  const age = personal ? customerAge(c) : null;
  // The Cloudinary photo, else the newest photo uploaded as a private document (served by the audited route).
  const privatePhoto = documents?.find(
    (d) =>
      d.category === "PHOTO" && !d.partyId && d.mimeType.startsWith("image/"),
  );
  const photoUrl =
    personal && c.photoKey
      ? customerPhotoUrl(customer.id, c.photoKey)
      : privatePhoto
        ? `/api/private-files/${privatePhoto.id}?view=1`
        : null;
  const professionLabels = customer.professionKeys
    .map((key) =>
      key === "other" && customer.professionOther
        ? customer.professionOther
        : labelOf(options.professions, key),
    )
    .filter(Boolean);

  return (
    <>
      <PageHeader
        title="Customer profile"
        crumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Customers", href: "/admin/customers" },
          { label: customer.reference },
        ]}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={telLink(customer.mobile)}>
                <Phone aria-hidden="true" /> Call
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href={whatsappLink(customer.whatsapp ?? customer.mobile)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon className="text-whatsapp" /> WhatsApp
              </a>
            </Button>
            {can(user, "bookings.edit") ? (
              <Button asChild size="sm">
                <Link href={`/admin/bookings/new?customerId=${customer.id}`}>
                  <Plus aria-hidden="true" /> New booking
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      {pendingDuplicates ? (
        <p className="mb-4 rounded-md border border-warning/40 bg-surface p-3 text-sm text-warning">
          This customer may be a duplicate.{" "}
          {can(user, "customers.merge") ? (
            <Link href="/admin/customers/duplicates" className="underline">
              Review duplicates
            </Link>
          ) : (
            "A manager will review it."
          )}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Card className="overflow-hidden pt-0">
            <div className="h-20 bg-blush/60" aria-hidden="true" />
            <div className="-mt-12 flex flex-col gap-4 px-6 sm:flex-row sm:items-end">
              {personal && can(user, "customers.edit") ? (
                <AvatarPhoto
                  name={customer.fullName}
                  photoUrl={photoUrl}
                  hasOwnPhoto={Boolean(c.photoKey)}
                  action={changePhotoAction.bind(null, customer.id)}
                />
              ) : photoUrl ? (
                <ImageViewer
                  src={photoUrl}
                  title={customer.fullName}
                  label={`Open ${customer.fullName}'s photo`}
                  className="w-fit shrink-0 rounded-full"
                >
                  <PersonAvatar
                    name={customer.fullName}
                    photoUrl={photoUrl}
                    size="xl"
                  />
                </ImageViewer>
              ) : (
                <PersonAvatar
                  name={customer.fullName}
                  photoUrl={photoUrl}
                  size="xl"
                />
              )}
              <div className="min-w-0 flex-1 pb-1">
                <h2 className="text-xl font-semibold text-primary-deep">
                  {customer.fullName}
                </h2>
                <p className="text-sm text-text-muted">
                  {customer.reference} · customer since{" "}
                  {formatIST(customer.createdAt, "MMM yyyy")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {customer.categoryKey ? (
                    <TonePill tone={toneFor(customer.categoryKey)}>
                      {labelOf(options.categories, customer.categoryKey)}
                    </TonePill>
                  ) : null}
                  <TonePill tone="green">
                    {customer.bookings.length} booking
                    {customer.bookings.length === 1 ? "" : "s"}
                  </TonePill>
                  <TonePill tone="blue">
                    {customer.leads.length} enquir
                    {customer.leads.length === 1 ? "y" : "ies"}
                  </TonePill>
                  {customer.city ? (
                    <TonePill tone="plum">{customer.city}</TonePill>
                  ) : null}
                </div>
              </div>
            </div>
            <CardContent>
              <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-6">
                <a
                  href={telLink(customer.mobile)}
                  className="inline-flex items-center gap-2 rounded-full bg-info/10 px-3 py-1.5 text-sm text-info hover:bg-info/20"
                >
                  <Phone className="size-4" aria-hidden="true" />{" "}
                  {formatPhoneForDisplay(customer.mobile)}
                </a>
                <a
                  href={whatsappLink(customer.whatsapp ?? customer.mobile)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-whatsapp/10 px-3 py-1.5 text-sm text-success hover:bg-whatsapp/20"
                >
                  <WhatsAppIcon className="size-4 text-whatsapp" />{" "}
                  {formatPhoneForDisplay(customer.whatsapp ?? customer.mobile)}
                </a>
                {customer.email ? (
                  <a
                    href={`mailto:${customer.email}`}
                    className="inline-flex items-center gap-2 rounded-full bg-lavender px-3 py-1.5 text-sm text-primary-deep hover:bg-lavender/70"
                  >
                    <Mail className="size-4" aria-hidden="true" />{" "}
                    {customer.email}
                  </a>
                ) : null}
              </div>
              <div className="mb-6 flex flex-col gap-6 sm:flex-row">
                <dl className="grid flex-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
                  <Detail label="Mobile">
                    {formatPhoneForDisplay(customer.mobile)}
                  </Detail>
                  {customer.whatsapp ? (
                    <Detail label="WhatsApp">
                      {formatPhoneForDisplay(customer.whatsapp)}
                    </Detail>
                  ) : null}
                  <Detail label="Email">{customer.email}</Detail>
                  <Detail label="Category">
                    {labelOf(options.categories, customer.categoryKey)}
                  </Detail>
                  {customer.companyName ? (
                    <Detail label="Company">{customer.companyName}</Detail>
                  ) : null}
                  {personal ? (
                    <Detail label="Age">
                      {age
                        ? age.approximate
                          ? `About ${age.years} (approx.)`
                          : age.years
                        : "—"}
                    </Detail>
                  ) : null}
                  <div className="sm:col-span-3">
                    <Detail label="Profession">
                      {professionLabels.length ? (
                        <span className="flex flex-wrap gap-1.5">
                          {professionLabels.map((label) => (
                            <Badge key={label} variant="secondary">
                              {label}
                            </Badge>
                          ))}
                        </span>
                      ) : null}
                    </Detail>
                  </div>
                  {personal &&
                  (c.address || c.locality || customer.city || c.mapsUrl) ? (
                    <div className="sm:col-span-3">
                      <Detail label="Address">
                        <span className="block whitespace-pre-line">
                          {[c.address, c.locality, customer.city]
                            .filter(Boolean)
                            .join(", ") || "—"}
                        </span>
                        {c.mapsUrl ? (
                          <a
                            href={c.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                          >
                            <MapPin className="size-4" aria-hidden="true" />{" "}
                            Open in Google Maps
                          </a>
                        ) : null}
                      </Detail>
                    </div>
                  ) : null}
                </dl>
              </div>
              {can(user, "customers.edit") ? (
                <details id="edit" open={openEdit} className="scroll-mt-6">
                  <summary className="cursor-pointer text-sm font-medium text-primary">
                    Edit details
                  </summary>
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
                        companyName: customer.companyName ?? "",
                        categoryKey: customer.categoryKey ?? "",
                        professionKeys: customer.professionKeys,
                        professionOther: customer.professionOther ?? "",
                        city: customer.city ?? "",
                        notes: customer.notes ?? "",
                        maritalStatus: c.maritalStatus ?? "",
                        dateOfBirth: c.dateOfBirth
                          ? dateKey(c.dateOfBirth)
                          : "",
                        approxAge: age?.approximate ? String(age.years) : "",
                        anniversary: c.anniversary
                          ? dateKey(c.anniversary)
                          : "",
                        spouseName: c.spouseName ?? "",
                        locality: c.locality ?? "",
                        address: c.address ?? "",
                        mapsUrl: c.mapsUrl ?? "",
                        photoUrl,
                      }}
                    />
                  </div>
                </details>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <SectionTitle icon={CalendarDays} tone="rose">
                  Bookings
                </SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customer.bookings.length ? (
                <ul className="space-y-2">
                  {customer.bookings.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-4 rounded-lg border-l-4 border-primary bg-blush/30 px-3 py-2.5"
                    >
                      <div>
                        {can(user, "bookings.read") ? (
                          <Link
                            href={`/admin/bookings/${b.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {b.mainEventName}
                          </Link>
                        ) : (
                          <span className="font-medium">{b.mainEventName}</span>
                        )}
                        <p className="text-xs text-text-muted">
                          {b.reference} ·{" "}
                          {b.startDate
                            ? formatDateKey(b.startDate)
                            : "dates to be set"}
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
              <CardHeader>
                <CardTitle>
                  <SectionTitle icon={Inbox} tone="blue">
                    Enquiries
                  </SectionTitle>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {customer.leads.map((l) => {
                    const status = statuses.find(
                      (s) => s.value === l.statusKey,
                    );
                    return (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-4 rounded-lg border-l-4 border-info bg-info/5 px-3 py-2.5"
                      >
                        <div>
                          {can(user, "leads.read") ? (
                            <Link
                              href={`/admin/leads/${l.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {l.reference}
                            </Link>
                          ) : (
                            l.reference
                          )}
                          <p className="text-xs text-text-muted">
                            {formatIST(l.createdAt, "d MMM yyyy")}
                          </p>
                        </div>
                        <LeadStatusBadge
                          label={status?.label ?? l.statusKey}
                          systemKey={status?.systemKey}
                          statusKey={l.statusKey}
                        />
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          <WhatsAppHistory entries={whatsapp} />

          <Card>
            <CardHeader>
              <CardTitle>
                <SectionTitle icon={History} tone="amber">
                  Activity
                </SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline entries={timeline} />
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {documents ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <SectionTitle icon={FileLock2} tone="plum">
                    Private documents
                  </SectionTitle>
                </CardTitle>
                <p className="text-sm text-text-muted">
                  Stored privately. Every view is recorded. Prefer masked
                  Aadhaar copies.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {documents.length ? (
                  <ul className="space-y-3 text-sm">
                    {documents.map((d) => (
                      <li
                        key={d.id}
                        className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-bg p-2"
                      >
                        {d.mimeType.startsWith("image/") ? (
                          <ImageViewer
                            src={`/api/private-files/${d.id}?view=1`}
                            title={
                              DOCUMENT_CATEGORIES.find(
                                (x) => x.value === d.category,
                              )?.label ?? d.fileName
                            }
                            downloadHref={`/api/private-files/${d.id}`}
                            label={`Open ${d.fileName}`}
                            className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- private file through the audited route */}
                            <img
                              src={`/api/private-files/${d.id}?thumb=1`}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          </ImageViewer>
                        ) : (
                          <a
                            href={`/api/private-files/${d.id}`}
                            className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface hover:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                            aria-label={`Download ${d.fileName}`}
                          >
                            <FileText
                              className="size-7 text-primary"
                              aria-hidden="true"
                            />
                          </a>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            {DOCUMENT_CATEGORIES.find(
                              (x) => x.value === d.category,
                            )?.label ?? d.category}
                            {d.label ? ` — ${d.label}` : ""}
                          </p>
                          {d.idNumber ? (
                            <p className="font-mono text-xs">{d.idNumber}</p>
                          ) : null}
                          <p className="truncate text-xs text-text-muted">
                            {d.fileName} · {kb(d.sizeBytes)} ·{" "}
                            {formatIST(d.createdAt, "d MMM yyyy")}
                            {d.partyId ? " · bride/groom" : ""}
                          </p>
                          {d.purpose ? (
                            <p className="text-xs text-text-muted">
                              Purpose: {d.purpose}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <a
                              href={`/api/private-files/${d.id}`}
                              aria-label={`Download ${d.fileName}`}
                            >
                              <Download aria-hidden="true" />
                            </a>
                          </Button>
                          {can(user, "documents.sensitive.upload") ? (
                            <ConfirmAction
                              action={deleteDocumentAction.bind(
                                null,
                                customer.id,
                                d.id,
                              )}
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
                  <ActionPanel
                    action={uploadDocumentAction.bind(null, customer.id)}
                    submitLabel="Upload privately"
                    resetAfter
                  >
                    <SelectField
                      name="category"
                      label="Type"
                      options={DOCUMENT_CATEGORIES.map((d) => ({
                        value: d.value,
                        label: d.label,
                      }))}
                      placeholder="Choose…"
                    />
                    <TextField name="label" label="Label (optional)" />
                    <TextField
                      name="idNumber"
                      label="ID number (optional)"
                      autoComplete="off"
                      hint="For Aadhaar only the last 4 digits are saved."
                    />
                    <TextField
                      name="purpose"
                      label="Why is this needed?"
                      required
                    />
                    <CompressedFileField
                      name="file"
                      label="Photo or PDF (photos are compressed to WebP)"
                      preset="document"
                      required
                    />
                  </ActionPanel>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>
                <SectionTitle icon={ShieldCheck} tone="green">
                  Communication consent
                </SectionTitle>
              </CardTitle>
              <p className="text-sm text-text-muted">
                Record only what the customer actually agreed to. Booking
                messages don&apos;t need this.
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {CONSENT_PURPOSES.map((p) => {
                  const record = consents.get(p.value);
                  return (
                    <li
                      key={p.value}
                      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${record?.granted ? "bg-success/10" : "bg-bg"}`}
                    >
                      <div>
                        <p>{p.label}</p>
                        <p className="text-xs text-text-muted">
                          {record
                            ? `${record.granted ? "Opted in" : "Opted out"} ${formatIST(record.createdAt, "d MMM yyyy")}`
                            : "Not asked"}
                        </p>
                      </div>
                      {can(user, "customers.edit") ? (
                        <InlineAction
                          action={setConsentAction.bind(null, customer.id)}
                          fields={{
                            purpose: p.value,
                            granted: record?.granted ? "false" : "true",
                          }}
                          variant="outline"
                          size="sm"
                        >
                          {record?.granted ? "Record opt-out" : "Record opt-in"}
                        </InlineAction>
                      ) : (
                        <Badge
                          variant={record?.granted ? "success" : "secondary"}
                        >
                          {record?.granted ? "Yes" : "No"}
                        </Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {can(user, "customers.edit") ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <SectionTitle icon={Copy} tone="gold">
                    Same person as another record?
                  </SectionTitle>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActionPanel
                  action={flagDuplicateAction.bind(null, customer.id)}
                  submitLabel="Send for review"
                  resetAfter
                >
                  <TextField
                    name="otherId"
                    label="Other customer's reference"
                    placeholder="SP-C-2026-00012"
                  />
                </ActionPanel>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
