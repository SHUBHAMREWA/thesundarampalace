import { Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InlineAction } from "@/components/crm/action-kit";
import { convertLeadAction } from "@/server/actions/customers";

import { PageHeader } from "@/components/crm/page-header";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { LeadStatusBadge } from "@/components/crm/status-badge";
import { WhatsAppHistory } from "@/components/crm/whatsapp-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatPhoneForDisplay,
  telLink,
  whatsappLink,
} from "@/lib/contact/links";
import { t } from "@/lib/i18n/localized";
import { formatIST } from "@/lib/time";
import { db } from "@/lib/db";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import {
  assignableStaff,
  getLead,
  NotFoundError,
} from "@/server/services/leads";
import { labelOf, lookupOptions } from "@/server/services/lookups";
import { messageHistory } from "@/server/services/whatsapp/campaigns";

import {
  ActivityForm,
  ArchiveLeadButton,
  AssignForm,
  DetailsForm,
  StatusForm,
} from "./lead-forms";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Lead" };

const ACTIVITY_LABEL: Record<string, string> = {
  CREATED: "Enquiry received",
  MERGED_ENQUIRY: "Repeat enquiry",
  CALL: "Phone call",
  WHATSAPP: "WhatsApp",
  VISIT: "Site visit",
  NOTE: "Note",
  STATUS_CHANGE: "Status changed",
  ASSIGNED: "Assignment changed",
  UPDATED: "Details updated",
};

/** datetime-local value in Asia/Kolkata. */
const toLocalInput = (d: Date | null) =>
  d ? formatIST(d, "yyyy-MM-dd'T'HH:mm") : "";

export default async function LeadPage({
  params,
}: PageProps<"/admin/leads/[id]">) {
  const { id } = await params;
  const user = await requirePermission("leads.read");
  let data;
  try {
    data = await getLead(user, id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { lead, actorNames, consent } = data;
  const [statuses, sources, lostReasons, eventTypes, staff, halls] =
    await Promise.all([
      lookupOptions("lead_status"),
      lookupOptions("lead_source"),
      lookupOptions("lost_reason"),
      lookupOptions("event_type"),
      can(user, "leads.assign") ? assignableStaff() : Promise.resolve([]),
      // Removed (archived) venues are hidden, unless this enquiry already chose one.
      db.hall.findMany({
        where: {
          OR: [
            { active: true },
            ...(lead.preferredHallId ? [{ id: lead.preferredHallId }] : []),
          ],
        },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true },
      }),
    ]);
  const status = statuses.find((s) => s.value === lead.statusKey);
  const canEdit = can(user, "leads.edit");
  const utm = (lead.utm ?? {}) as Record<string, string>;
  const greeting = `Namaste ${lead.fullName.split(" ")[0]}, thank you for your enquiry (${lead.reference}) with The Sundaram Palace.`;

  return (
    <>
      <PageHeader
        title={lead.fullName}
        description={`${lead.reference} · received ${formatIST(lead.createdAt)}`}
        crumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Leads", href: "/admin/leads" },
          { label: lead.reference },
        ]}
        actions={
          <>
            {lead.customerId ? (
              <>
                {can(user, "customers.read") ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/customers/${lead.customerId}`}>
                      Customer
                    </Link>
                  </Button>
                ) : null}
                {can(user, "bookings.edit") ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/admin/bookings/new?customerId=${lead.customerId}&leadId=${lead.id}`}
                    >
                      New booking
                    </Link>
                  </Button>
                ) : null}
              </>
            ) : can(user, "customers.edit") && canEdit ? (
              <InlineAction
                action={convertLeadAction.bind(null, lead.id)}
                variant="outline"
                size="sm"
              >
                Convert to customer
              </InlineAction>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <a href={telLink(lead.phone)}>
                <Phone aria-hidden="true" /> Call
              </a>
            </Button>
            <Button asChild size="sm">
              <a
                href={whatsappLink(lead.phone, greeting)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon /> Chat on WhatsApp
              </a>
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Enquiry</CardTitle>
              <LeadStatusBadge
                label={status?.label ?? lead.statusKey}
                systemKey={status?.systemKey}
                statusKey={lead.statusKey}
              />
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-text-muted">Phone</dt>
                  <dd>{formatPhoneForDisplay(lead.phone)}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Email</dt>
                  <dd>{lead.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Prefers</dt>
                  <dd className="capitalize">{lead.contactPreference}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Event</dt>
                  <dd>{labelOf(eventTypes, lead.eventTypeKey)}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Preferred date</dt>
                  <dd>
                    {lead.preferredDate
                      ? formatIST(lead.preferredDate, "EEE d MMM yyyy")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Guests (approx.)</dt>
                  <dd>{lead.guestsApprox ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Preferred venue</dt>
                  <dd>
                    {lead.preferredHall
                      ? t(lead.preferredHall.name, "en")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Language</dt>
                  <dd>{lead.locale === "hi" ? "Hindi" : "English"}</dd>
                </div>
              </dl>
              {lead.message ? (
                <div className="mt-4 rounded-md bg-bg p-4 text-sm whitespace-pre-line">
                  {lead.message}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {canEdit ? (
            <Card id="details" className="scroll-mt-6">
              <CardHeader>
                <CardTitle>Details and follow-up</CardTitle>
              </CardHeader>
              <CardContent>
                <DetailsForm
                  leadId={lead.id}
                  eventTypes={eventTypes}
                  halls={halls.map((h) => ({
                    value: h.id,
                    label: t(h.name, "en"),
                  }))}
                  defaults={{
                    email: lead.email ?? "",
                    eventTypeKey: lead.eventTypeKey ?? "",
                    preferredDate: lead.preferredDate
                      ? lead.preferredDate.toISOString().slice(0, 10)
                      : "",
                    guestsApprox: lead.guestsApprox?.toString() ?? "",
                    budgetEstimate: lead.budgetEstimate?.toFixed(2) ?? "",
                    menuPreference: lead.menuPreference ?? "",
                    preferredHallId: lead.preferredHallId ?? "",
                    followUpAt: toLocalInput(lead.followUpAt),
                    siteVisitAt: toLocalInput(lead.siteVisitAt),
                    siteVisitOutcome: lead.siteVisitOutcome ?? "",
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          <WhatsAppHistory
            entries={await messageHistory(user, "lead", lead.id)}
          />

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {canEdit ? <ActivityForm leadId={lead.id} /> : null}
              <ol className="space-y-4 border-l border-border pl-5">
                {lead.activities.map((activity) => {
                  const data = (activity.data ?? {}) as Record<string, unknown>;
                  let detail: string | null = activity.note;
                  if (activity.kind === "STATUS_CHANGE") {
                    detail = `${labelOf(statuses, String(data.from))} → ${labelOf(statuses, String(data.to))}${
                      data.lostReasonKey
                        ? ` (${labelOf(lostReasons, String(data.lostReasonKey))})`
                        : ""
                    }${activity.note ? ` — ${activity.note}` : ""}`;
                  } else if (activity.kind === "UPDATED") {
                    detail = `Changed: ${Object.keys(data).join(", ")}`;
                  } else if (
                    activity.kind === "CREATED" ||
                    activity.kind === "MERGED_ENQUIRY"
                  ) {
                    detail = [
                      labelOf(sources, String(data.source ?? "")),
                      data.page ? `page ${String(data.page)}` : null,
                      activity.note,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                  }
                  return (
                    <li key={activity.id} className="relative">
                      <span
                        className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-primary"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-medium">
                        {ACTIVITY_LABEL[activity.kind] ?? activity.kind}
                      </p>
                      {detail ? (
                        <p className="text-sm whitespace-pre-line">{detail}</p>
                      ) : null}
                      <p className="text-xs text-text-muted">
                        {formatIST(activity.createdAt)}
                        {activity.actorId
                          ? ` · ${actorNames.get(activity.actorId) ?? "Staff"}`
                          : " · Website"}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusForm
                  leadId={lead.id}
                  current={lead.statusKey}
                  currentLostReason={lead.lostReasonKey}
                  statuses={statuses}
                  lostReasons={lostReasons}
                />
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              {can(user, "leads.assign") ? (
                <AssignForm
                  leadId={lead.id}
                  current={lead.assignedToId}
                  staff={staff.map((s) => ({ value: s.id, label: s.name }))}
                />
              ) : (
                <p className="text-sm">
                  {lead.assignedTo?.name ?? "Unassigned"}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Source</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-text-muted">Source</dt>
                  <dd>{labelOf(sources, lead.sourceKey)}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Campaign</dt>
                  <dd>{lead.campaign ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">UTM</dt>
                  <dd className="break-words">
                    {Object.keys(utm).length
                      ? Object.entries(utm)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(", ")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">Landing page</dt>
                  <dd className="break-words">{lead.landingPage ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Referrer</dt>
                  <dd className="break-words">{lead.referrer ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Consent to contact</dt>
                  <dd>
                    {consent
                      ? `${consent.granted ? "Given" : "Withdrawn"} ${formatIST(consent.createdAt, "d MMM yyyy")} (notice ${consent.noticeVersion})`
                      : "Not recorded"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          {can(user, "leads.assign") ? (
            <div className="text-right">
              <ArchiveLeadButton leadId={lead.id} />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
