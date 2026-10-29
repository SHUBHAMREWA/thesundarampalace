import { CalendarClock, ListTodo } from "lucide-react";
import Link from "next/link";

import { InlineAction } from "@/components/crm/action-kit";
import { TONES } from "@/components/crm/icon-chip";
import { PersonAvatar, SectionTitle } from "@/components/crm/person-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatIST, todayIST } from "@/lib/time";
import { cn } from "@/lib/utils";
import { setTaskStatusAction } from "@/server/actions/operations";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { taskVisibility } from "@/server/services/tasks";

const PRIORITY_TONE = { LOW: "plum", NORMAL: "blue", HIGH: "amber", URGENT: "red" } as const;

/**
 * Small task window beside the dashboard calendar: overdue first, then by
 * due date, with a one-click "Done". Admins see everyone's tasks.
 */
export async function TasksWindow({ user }: { user: CurrentUser }) {
  const visible = taskVisibility(user);
  const manage = can(user, "tasks.manage");
  const now = new Date();
  const today = todayIST();
  const open = { status: { in: ["OPEN" as const, "IN_PROGRESS" as const] } };
  const [openCount, overdueCount, tasks] = await Promise.all([
    db.task.count({ where: { AND: [visible, open] } }),
    db.task.count({ where: { AND: [visible, open, { dueAt: { lt: now } }] } }),
    db.task.findMany({
      where: { AND: [visible, open, { OR: [{ booking: null }, { booking: { deletedAt: null } }] }] },
      orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
      take: 6,
      select: {
        id: true,
        title: true,
        priority: true,
        dueAt: true,
        assignee: { select: { name: true } },
        booking: { select: { id: true, reference: true } },
      },
    }),
  ]);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>
          <SectionTitle icon={ListTodo} tone="amber">
            {manage ? "Tasks" : "My tasks"}
          </SectionTitle>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/admin/tasks?view=${manage ? "all" : "mine"}`} className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", TONES.blue)}>
            {openCount} open
          </Link>
          {overdueCount ? (
            <Link href="/admin/tasks?view=overdue" className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", TONES.red)}>
              {overdueCount} overdue
            </Link>
          ) : null}
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/tasks">View all</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length ? (
          <ul className="divide-y divide-border">
            {tasks.map((task) => {
              const overdue = task.dueAt !== null && task.dueAt < now;
              const dueToday = task.dueAt !== null && formatIST(task.dueAt, "yyyy-MM-dd") === today;
              return (
                <li key={task.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className={cn("h-9 w-1 shrink-0 rounded-full", overdue ? "bg-danger" : dueToday ? "bg-warning" : "bg-info/40")} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{task.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={cn("inline-flex items-center gap-1", overdue ? "font-medium text-danger" : dueToday ? "font-medium text-warning" : "text-text-muted")}>
                        <CalendarClock className="size-3.5" aria-hidden="true" />
                        {task.dueAt ? `${overdue ? "Overdue · " : dueToday ? "Today · " : ""}${formatIST(task.dueAt, dueToday ? "h:mm a" : "d MMM, h:mm a")}` : "No due date"}
                      </span>
                      <span className={cn("rounded-full px-2 py-px font-medium", TONES[PRIORITY_TONE[task.priority]])}>{task.priority.toLowerCase()}</span>
                      {task.booking ? (
                        <Link href={`/admin/bookings/${task.booking.id}`} className="text-text-muted hover:text-primary">
                          {task.booking.reference}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {manage && task.assignee ? (
                    <span title={`Assigned to ${task.assignee.name}`} className="hidden sm:inline-flex">
                      <PersonAvatar name={task.assignee.name} />
                    </span>
                  ) : null}
                  <InlineAction action={setTaskStatusAction.bind(null, task.id, "DONE")} size="sm" variant="outline">
                    Done
                  </InlineAction>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No open tasks. Nice work.</p>
        )}
      </CardContent>
    </Card>
  );
}
