import { AlarmClock, CalendarDays, Inbox, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { MonthCalendar, monthParam } from "@/components/crm/month-calendar";
import { SectionTitle } from "@/components/crm/person-avatar";
import { StatGrid, StatTile } from "@/components/crm/stat-tile";
import { PageHeader } from "@/components/crm/page-header";
import { LeadStatusBadge } from "@/components/crm/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatIST } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { leadVisibility } from "@/server/services/leads";
import { lookupOptions } from "@/server/services/lookups";

import { AccountsPanel } from "./accounts-panel";
import { AdminActivityPanel } from "./admin-activity-panel";
import { BookingPanel } from "./booking-panel";
import { OccasionsCard } from "./occasions-card";
import { OperationsPanel } from "./operations-panel";
import { TasksWindow } from "./tasks-window";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Role-aware dashboard (MASTER_PROMPT §16).
 * Surfaces metrics and operational panels tailored to the user's permissions:
 * - Sales: Enquiry metrics, follow-up queues, recent leads
 * - Bookings / Management: Upcoming functions, expiring holds, pending instalments
 * - Accounts: Net payments, outstanding balances, deposits, invoices, recent ledger
 * - Operations: Open & overdue tasks, functions today & tomorrow
 * - Admin: Audit activity logs
 */
export default async function DashboardPage({ searchParams }: PageProps<"/admin">) {
  const user = await requirePermission("dashboard.view");
  const month = monthParam((await searchParams).month);
  const firstName = user.name.split(" ")[0];

  const hasLeadsRead = can(user, "leads.read");
  const hasBookingsRead = can(user, "bookings.read");
  const hasPaymentsRead = can(user, "payments.read");
  const hasTasksOwn = can(user, "tasks.own");
  const hasAuditRead = can(user, "audit.read");
  const hasCustomersRead = can(user, "customers.read");

  // Load leads data only if permitted
  const leadsData = hasLeadsRead
    ? await (async () => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const visible = leadVisibility(user);
        const statuses = await lookupOptions("lead_status");
        const closedKeys = statuses.filter((s) => s.systemKey === "WON" || s.systemKey === "LOST").map((s) => s.value);

        const [newThisWeek, followUpsDue, mine, recent] = await Promise.all([
          db.lead.count({ where: { AND: [visible, { createdAt: { gte: weekAgo } }] } }),
          db.lead.count({
            where: {
              AND: [visible, { followUpAt: { lte: now } }, { statusKey: { notIn: closedKeys } }],
            },
          }),
          db.lead.count({
            where: { AND: [visible, { assignedToId: user.id }, { statusKey: { notIn: closedKeys } }] },
          }),
          db.lead.findMany({
            where: visible,
            orderBy: { createdAt: "desc" },
            take: 8,
            select: { id: true, reference: true, fullName: true, statusKey: true, createdAt: true },
          }),
        ]);

        return { newThisWeek, followUpsDue, mine, recent, statuses };
      })()
    : null;

  const hasAnySection = hasLeadsRead || hasBookingsRead || hasPaymentsRead || hasTasksOwn || hasAuditRead;

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} description="The Sundaram Palace CRM" />

      {!hasAnySection ? (
        <EmptyState icon={Inbox} title="Nothing to show yet" description="Work for your role will appear here." />
      ) : (
        <div className="space-y-8">
          {/* Top: calendar on the left (half width), quick tiles on the right. */}
          <div className={hasBookingsRead ? "grid items-start gap-6 lg:grid-cols-2" : undefined}>
            {hasBookingsRead ? (
              <Card id="calendar" className="scroll-mt-6">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>
                    <SectionTitle icon={CalendarDays} tone="green">
                      Calendar
                    </SectionTitle>
                  </CardTitle>
                  <Link href="/admin/calendar" className="text-sm text-text-muted hover:text-primary">
                    Full calendar
                  </Link>
                </CardHeader>
                <CardContent>
                  <MonthCalendar user={user} month={month} basePath="/admin" compact />
                </CardContent>
              </Card>
            ) : null}
            <div className="space-y-6">
              {/* Sales Lead Overview */}
              {leadsData ? (
                <div className="space-y-4">
                  <StatGrid half={hasBookingsRead}>
                    {[
                      {
                        label: "New leads, last 7 days",
                        value: leadsData.newThisWeek,
                        icon: Inbox,
                        href: "/admin/leads",
                      },
                      {
                        label: "Follow-ups due now",
                        value: leadsData.followUpsDue,
                        icon: AlarmClock,
                        href: "/admin/leads?followUp=overdue&sort=follow_up",
                      },
                      {
                        label: "My open leads",
                        value: leadsData.mine,
                        icon: UserCheck,
                        href: "/admin/leads?assigned=me",
                      },
                    ].map(({ label, value, icon, href }, i) => (
                      <StatTile key={label} label={label} value={value} icon={icon} href={href} tone={i} />
                    ))}
                  </StatGrid>
                </div>
              ) : null}

              {/* Birthdays and anniversaries of customers today */}
              {hasCustomersRead ? <OccasionsCard userId={user.id} /> : null}

              {/* Bookings overview */}
              {hasBookingsRead ? <BookingPanel user={user} /> : null}

              {/* Small task window fills the space beside the calendar. */}
              {hasTasksOwn ? <TasksWindow user={user} /> : null}
            </div>
          </div>

          {/* Accounts & Financial Overview */}
          {hasPaymentsRead ? <AccountsPanel user={user} /> : null}

          {/* Operations & Tasks Overview */}
          {hasTasksOwn ? <OperationsPanel user={user} /> : null}

          {/* Latest Enquiries */}
          {leadsData ? (
            <Card>
              <CardHeader>
                <CardTitle>Latest enquiries</CardTitle>
              </CardHeader>
              <CardContent>
                {leadsData.recent.length ? (
                  <ul className="divide-y divide-border">
                    {leadsData.recent.map((lead) => {
                      const status = leadsData.statuses.find((s) => s.value === lead.statusKey);
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
          ) : null}

          {/* Recent Administrative Audit Activity */}
          {hasAuditRead ? <AdminActivityPanel user={user} /> : null}
        </div>
      )}
    </>
  );
}
