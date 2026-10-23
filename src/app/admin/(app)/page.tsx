import { AlarmClock, Inbox, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { LeadStatusBadge } from "@/components/crm/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatIST } from "@/lib/time";
import { redirect } from "next/navigation";

import { requirePermission, requireUser } from "@/server/auth/session";

import { BookingPanel } from "./booking-panel";
import { can } from "@/server/policies/authorize";
import { leadVisibility } from "@/server/services/leads";
import { lookupOptions } from "@/server/services/lookups";

export const metadata: Metadata = { title: "Dashboard" };

/** Role-aware dashboard: counts come from real records only (MASTER_PROMPT §16). */
export default async function DashboardPage() {
  const current = await requireUser();
  // Kitchen staff have no dashboard; their home is the kitchen sheets.
  if (!current.permissions.has("dashboard.view") && current.permissions.has("kitchen.read")) redirect("/admin/kitchen");
  const user = await requirePermission("dashboard.view");
  const bookingPanel = can(user, "bookings.read") ? <BookingPanel user={user} /> : null;
  const firstName = user.name.split(" ")[0];

  if (!can(user, "leads.read")) {
    return (
      <>
        <PageHeader title={`Welcome, ${firstName}`} description="The Sundaram Palace CRM" />
        {bookingPanel ?? (
          <EmptyState icon={Inbox} title="Nothing to show yet" description="Work for your role will appear here." />
        )}
      </>
    );
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const visible = leadVisibility(user);
  const statuses = await lookupOptions("lead_status");
  const closedKeys = statuses.filter((s) => s.systemKey === "WON" || s.systemKey === "LOST").map((s) => s.value);
  const [newThisWeek, followUpsDue, mine, recent] = await Promise.all([
    db.lead.count({ where: { AND: [visible, { createdAt: { gte: weekAgo } }] } }),
    db.lead.count({ where: { AND: [visible, { followUpAt: { lte: now } }, { statusKey: { notIn: closedKeys } }] } }),
    db.lead.count({ where: { AND: [visible, { assignedToId: user.id }, { statusKey: { notIn: closedKeys } }] } }),
    db.lead.findMany({
      where: visible,
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, reference: true, fullName: true, statusKey: true, createdAt: true },
    }),
  ]);

  const tiles = [
    { label: "New leads, last 7 days", value: newThisWeek, icon: Inbox, href: "/admin/leads" },
    { label: "Follow-ups due now", value: followUpsDue, icon: AlarmClock, href: "/admin/leads?followUp=overdue&sort=follow_up" },
    { label: "My open leads", value: mine, icon: UserCheck, href: "/admin/leads?assigned=me" },
  ];

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} description="The Sundaram Palace CRM" />
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-sm">{label}</span>
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </Link>
        ))}
      </div>

      {bookingPanel ? <div className="mt-6">{bookingPanel}</div> : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Latest enquiries</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length ? (
            <ul className="divide-y divide-border">
              {recent.map((lead) => {
                const status = statuses.find((s) => s.value === lead.statusKey);
                return (
                  <li key={lead.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Link href={`/admin/leads/${lead.id}`} className="font-medium text-primary hover:underline">
                        {lead.fullName}
                      </Link>
                      <p className="text-xs text-text-muted">
                        {lead.reference} · {formatIST(lead.createdAt, "d MMM, h:mm a")}
                      </p>
                    </div>
                    <LeadStatusBadge label={status?.label ?? lead.statusKey} systemKey={status?.systemKey} statusKey={lead.statusKey} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={Inbox} title="No enquiries yet" description="Website enquiries will appear here as soon as they arrive." />
          )}
        </CardContent>
      </Card>
    </>
  );
}
