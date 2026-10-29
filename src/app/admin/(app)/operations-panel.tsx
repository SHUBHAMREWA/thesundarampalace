import { CalendarCheck, ClockAlert, ListTodo } from "lucide-react";
import Link from "next/link";

import { StatGrid, StatTile } from "@/components/crm/stat-tile";
import { InlineAction } from "@/components/crm/action-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { addDays, dateFromKey, dateKey, formatIST, todayIST } from "@/lib/time";
import { setTaskStatusAction } from "@/server/actions/operations";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { taskVisibility } from "@/server/services/tasks";

const PRIORITY_VARIANT = {
  LOW: "secondary",
  NORMAL: "outline",
  HIGH: "warning",
  URGENT: "danger",
} as const;

/**
 * Operations dashboard panel (MASTER_PROMPT §16).
 * Shows open & overdue tasks, functions scheduled for today & tomorrow, and quick actions.
 */
export async function OperationsPanel({ user }: { user: CurrentUser }) {
  if (!can(user, "tasks.own")) return null;

  const now = new Date();
  const today = todayIST();
  const tomorrow = addDays(today, 1);
  const manageTasks = can(user, "tasks.manage");
  const visible = taskVisibility(user);

  const [myOpenTasksCount, overdueTasksCount, todayFunctions, upcomingTasks] = await Promise.all([
    db.task.count({
      where: {
        AND: [visible, { status: { in: ["OPEN", "IN_PROGRESS"] } }],
      },
    }),
    db.task.count({
      where: {
        AND: [visible, { status: { in: ["OPEN", "IN_PROGRESS"] } }, { dueAt: { lte: now } }],
      },
    }),
    db.bookingSubEvent.findMany({
      where: {
        date: { in: [dateFromKey(today), dateFromKey(tomorrow)] },
        reservation: { state: "CONFIRMED" },
        booking: { status: { in: ["CONFIRMED", "IN_PROGRESS"] }, deletedAt: null },
      },
      orderBy: { startsAt: "asc" },
      take: 6,
      select: {
        id: true,
        name: true,
        date: true,
        startsAt: true,
        endsAt: true,
        hall: { select: { name: true } },
        booking: { select: { id: true, reference: true, mainEventName: true } },
      },
    }),
    db.task.findMany({
      where: {
        AND: [visible, { status: { in: ["OPEN", "IN_PROGRESS"] } }],
      },
      orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
      take: 5,
      select: {
        id: true,
        title: true,
        priority: true,
        dueAt: true,
        status: true,
        booking: { select: { id: true, reference: true } },
      },
    }),
  ]);

  const tiles = [
    {
      label: manageTasks ? "All open tasks" : "My open tasks",
      value: myOpenTasksCount,
      icon: ListTodo,
      href: "/admin/tasks?view=mine",
    },
    {
      label: "Overdue tasks",
      value: overdueTasksCount,
      icon: ClockAlert,
      href: "/admin/tasks?view=overdue",
    },
    {
      label: "Events today & tomorrow",
      value: todayFunctions.length,
      icon: CalendarCheck,
      href: "/admin/calendar",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Event Operations &amp; Tasks</h2>
          <p className="text-sm text-text-muted">Day-of-event schedules, duties, and active tasks.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/tasks">Task board</Link>
          </Button>
        </div>
      </div>

      <StatGrid>
        {tiles.map(({ label, value, icon, href }, i) => (
          <StatTile key={label} label={label} value={value} icon={icon} href={href} tone={i + 1} />
        ))}
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming event schedules</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/calendar">Calendar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todayFunctions.length ? (
              <ul className="divide-y divide-border">
                {todayFunctions.map((f) => (
                  <li key={f.id} className="py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Link
                        href={`/admin/bookings/${f.booking.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {f.name}
                      </Link>
                      <Badge variant="outline">
                        {dateKey(f.date) === today ? "Today" : "Tomorrow"}
                      </Badge>
                    </div>
                    <p className="text-xs text-text-muted">
                      {t(f.hall.name, "en")} · {formatIST(f.startsAt, "h:mm a")}–{formatIST(f.endsAt, "h:mm a")} · {f.booking.reference}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No confirmed functions today or tomorrow.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>High priority &amp; due tasks</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/tasks">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length ? (
              <ul className="divide-y divide-border">
                {upcomingTasks.map((task) => {
                  const overdue = task.dueAt && task.dueAt < now;
                  return (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">
                          {task.title}
                          <Badge
                            variant={PRIORITY_VARIANT[task.priority]}
                            className="ml-1.5"
                          >
                            {task.priority.toLowerCase()}
                          </Badge>
                        </p>
                        <p className={`text-xs ${overdue ? "font-medium text-danger" : "text-text-muted"}`}>
                          {task.dueAt ? `Due ${formatIST(task.dueAt, "d MMM, h:mm a")}` : "No due date"}
                          {task.booking ? ` · ${task.booking.reference}` : ""}
                        </p>
                      </div>
                      <InlineAction
                        action={setTaskStatusAction.bind(null, task.id, "DONE")}
                        size="sm"
                        variant="outline"
                      >
                        Done
                      </InlineAction>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No urgent tasks assigned to you right now.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
