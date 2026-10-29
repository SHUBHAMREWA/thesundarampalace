import { Inbox, Pencil, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmAction } from "@/components/crm/action-kit";
import { nativeSelectClass } from "@/components/forms/form-kit";
import { PageHeader } from "@/components/crm/page-header";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { LeadStatusBadge } from "@/components/crm/status-badge";
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
import { formatPhoneForDisplay, whatsappLink } from "@/lib/contact/links";
import { formatIST } from "@/lib/time";
import { archiveLeadAction } from "@/server/actions/leads";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import {
  assignableStaff,
  leadListQuerySchema,
  listLeads,
} from "@/server/services/leads";
import { labelOf, lookupOptions } from "@/server/services/lookups";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({
  searchParams,
}: PageProps<"/admin/leads">) {
  const user = await requirePermission("leads.read");
  const query = leadListQuerySchema.parse(await searchParams);
  const [{ rows, total, pageCount }, statuses, sources, eventTypes, staff] =
    await Promise.all([
      listLeads(user, query),
      lookupOptions("lead_status"),
      lookupOptions("lead_source"),
      lookupOptions("event_type"),
      can(user, "leads.read_all") ? assignableStaff() : Promise.resolve([]),
    ]);

  const filtered = Boolean(
    query.q || query.status || query.source || query.assigned || query.followUp,
  );
  const canEdit = can(user, "leads.edit");
  const canDelete = can(user, "leads.assign");
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...query, page })) {
      if (
        value !== undefined &&
        value !== "" &&
        !(key === "sort" && value === "newest") &&
        !(key === "page" && value === 1)
      ) {
        params.set(key, String(value));
      }
    }
    const qs = params.toString();
    return `/admin/leads${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Leads"
        description={`${total} ${total === 1 ? "lead" : "leads"}${filtered ? " match these filters" : ""}`}
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Leads" }]}
        actions={
          can(user, "leads.edit") ? (
            <Button asChild>
              <Link href="/admin/leads/new">
                <Plus aria-hidden="true" /> New lead
              </Link>
            </Button>
          ) : undefined
        }
      />

      <form
        method="get"
        className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-6"
        role="search"
      >
        <div className="relative md:col-span-2">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 size-4 text-text-muted"
            aria-hidden="true"
          />
          <label htmlFor="q" className="sr-only">
            Search by name, phone or reference
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={query.q}
            placeholder="Name, phone or SP-L-…"
            className="bg-surface pl-9"
          />
        </div>
        <label className="sr-only" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={query.status ?? ""}
          className={nativeSelectClass}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="source">
          Source
        </label>
        <select
          id="source"
          name="source"
          defaultValue={query.source ?? ""}
          className={nativeSelectClass}
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="assigned">
          Assigned to
        </label>
        <select
          id="assigned"
          name="assigned"
          defaultValue={query.assigned ?? ""}
          className={nativeSelectClass}
        >
          <option value="">Anyone</option>
          <option value="me">Me</option>
          <option value="none">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="sort">
          Sort
        </label>
        <select
          id="sort"
          name="sort"
          defaultValue={query.sort}
          className={nativeSelectClass}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="follow_up">Follow-up date</option>
          <option value="activity">Recent activity</option>
        </select>
        <div className="flex items-center gap-3 md:col-span-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="followUp"
              value=""
              defaultChecked={!query.followUp}
              className="accent-primary"
            />{" "}
            All
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="followUp"
              value="due"
              defaultChecked={query.followUp === "due"}
              className="accent-primary"
            />{" "}
            Follow-up due today
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="followUp"
              value="overdue"
              defaultChecked={query.followUp === "overdue"}
              className="accent-primary"
            />{" "}
            Overdue
          </label>
          <div className="ml-auto flex gap-2">
            {filtered ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/leads">Clear filters</Link>
              </Button>
            ) : null}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </div>
      </form>

      {rows.length ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead className="hidden md:table-cell">Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Assigned</TableHead>
                <TableHead className="hidden md:table-cell">
                  Follow-up
                </TableHead>
                <TableHead className="hidden sm:table-cell">Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((lead) => {
                const status = statuses.find((s) => s.value === lead.statusKey);
                const overdue = lead.followUpAt && lead.followUpAt < new Date();
                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Link
                        href={`/admin/leads/${lead.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {lead.fullName}
                      </Link>
                      <div className="text-xs text-text-muted">
                        {lead.reference} · {formatPhoneForDisplay(lead.phone)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {labelOf(eventTypes, lead.eventTypeKey)}
                      {lead.preferredDate ? (
                        <div className="text-xs text-text-muted">
                          {formatIST(lead.preferredDate, "d MMM yyyy")}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge
                        label={status?.label ?? lead.statusKey}
                        systemKey={status?.systemKey}
                        statusKey={lead.statusKey}
                      />
                      <div className="mt-1 text-xs text-text-muted">
                        {labelOf(sources, lead.sourceKey)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {lead.assignedTo?.name ?? (
                        <span className="text-text-muted">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell
                      className={`hidden md:table-cell ${overdue ? "font-medium text-danger" : ""}`}
                    >
                      {lead.followUpAt
                        ? formatIST(lead.followUpAt, "d MMM, h:mm a")
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden text-sm text-text-muted sm:table-cell">
                      {formatIST(lead.createdAt, "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="sm">
                          <a
                            href={whatsappLink(
                              lead.phone,
                              `Namaste ${lead.fullName.split(" ")[0]}, thank you for your enquiry (${lead.reference}) with The Sundaram Palace.`,
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Chat with ${lead.fullName} on WhatsApp`}
                          >
                            <WhatsAppIcon className="text-whatsapp" /> WhatsApp
                          </a>
                        </Button>
                        {canEdit ? (
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/admin/leads/${lead.id}#details`}
                              aria-label={`Edit ${lead.fullName}`}
                            >
                              <Pencil aria-hidden="true" /> Edit
                            </Link>
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <ConfirmAction
                            action={archiveLeadAction.bind(null, lead.id)}
                            label="Delete"
                            title={`Delete ${lead.fullName}?`}
                            description="Use this for spam, test entries or duplicates. The lead disappears from lists; its history is kept and the audit log records who deleted it and why."
                            confirmLabel="Delete lead"
                            reasonName="reason"
                            reasonLabel="Why?"
                            reasonRequired
                            destructive
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={Inbox}
          title={filtered ? "No leads match these filters" : "No leads yet"}
          description={
            filtered
              ? "Try clearing a filter."
              : "Enquiries from the website's “Plan your event” form appear here."
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
