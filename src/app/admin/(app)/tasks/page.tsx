import { CheckSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActionPanel, InlineAction } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import { SelectField, TextAreaField, TextField } from "@/components/forms/form-kit";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatIST } from "@/lib/time";
import { createTaskAction, setTaskStatusAction } from "@/server/actions/operations";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { listTasks, PRIORITIES, taskListQuerySchema } from "@/server/services/tasks";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Tasks" };

const VIEWS = [
  { key: "mine", label: "My open tasks" },
  { key: "overdue", label: "Overdue" },
  { key: "all", label: "All open" },
  { key: "done", label: "Done" },
] as const;

const PRIORITY_VARIANT = { LOW: "secondary", NORMAL: "outline", HIGH: "warning", URGENT: "danger" } as const;

export default async function TasksPage({ searchParams }: PageProps<"/admin/tasks">) {
  const user = await requirePermission("tasks.own");
  const query = taskListQuerySchema.parse(await searchParams);
  const manage = can(user, "tasks.manage");
  const [{ rows, total, pageCount }, staff] = await Promise.all([
    listTasks(user, query),
    manage ? db.user.findMany({ where: { active: true, roles: { some: { role: { permissions: { some: { permissionKey: "tasks.own" } } } } } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader
        title="Tasks"
        description={`${total} ${total === 1 ? "task" : "tasks"}`}
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Tasks" }]}
      />
      <nav aria-label="Task views" className="mb-4 flex flex-wrap gap-2">
        {VIEWS.filter((v) => manage || v.key !== "all").map((v) => (
          <Link key={v.key} href={`/admin/tasks?view=${v.key}`} aria-current={query.view === v.key ? "page" : undefined} className={`rounded-md border px-3 py-1.5 text-sm ${query.view === v.key ? "border-primary bg-blush text-primary" : "border-border bg-surface"}`}>
            {v.label}
          </Link>
        ))}
      </nav>
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {rows.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {rows.map((task) => {
                const overdue = task.dueAt && task.dueAt < now && (task.status === "OPEN" || task.status === "IN_PROGRESS");
                return (
                  <li key={task.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-medium">{task.title} <Badge variant={PRIORITY_VARIANT[task.priority]} className="ml-1">{task.priority.toLowerCase()}</Badge></p>
                      {task.description ? <p className="text-sm text-text-muted whitespace-pre-line">{task.description}</p> : null}
                      <p className={`text-xs ${overdue ? "font-medium text-danger" : "text-text-muted"}`}>
                        {task.dueAt ? `Due ${formatIST(task.dueAt, "d MMM, h:mm a")}` : "No due date"}
                        {task.assignee ? ` · ${task.assignee.name}` : " · unassigned"}
                        {task.booking ? <> · <Link href={`/admin/bookings/${task.booking.id}`} className="text-primary hover:underline">{task.booking.reference}</Link></> : null}
                        {task.lead ? <> · <Link href={`/admin/leads/${task.lead.id}`} className="text-primary hover:underline">{task.lead.reference}</Link></> : null}
                        {task.completedAt ? ` · done ${formatIST(task.completedAt, "d MMM")}` : ""}
                      </p>
                    </div>
                    {task.status === "OPEN" || task.status === "IN_PROGRESS" ? (
                      <div className="flex gap-1">
                        {task.status === "OPEN" ? <InlineAction action={setTaskStatusAction.bind(null, task.id, "IN_PROGRESS")} variant="ghost" size="sm">Start</InlineAction> : null}
                        <InlineAction action={setTaskStatusAction.bind(null, task.id, "DONE")} variant="outline" size="sm">Done</InlineAction>
                        <InlineAction action={setTaskStatusAction.bind(null, task.id, "CANCELLED")} variant="ghost" size="sm" className="text-text-muted">Cancel</InlineAction>
                      </div>
                    ) : (
                      <Badge variant={task.status === "DONE" ? "success" : "secondary"}>{task.status.toLowerCase()}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={CheckSquare} title="Nothing here" description="Tasks you and your team add appear here." />
          )}
          {pageCount > 1 ? (
            <nav aria-label="Pagination" className="mt-4 flex gap-2">
              {query.page > 1 ? <Button asChild variant="outline" size="sm"><Link href={`/admin/tasks?view=${query.view}&page=${query.page - 1}`}>Previous</Link></Button> : null}
              {query.page < pageCount ? <Button asChild variant="outline" size="sm"><Link href={`/admin/tasks?view=${query.view}&page=${query.page + 1}`}>Next</Link></Button> : null}
            </nav>
          ) : null}
        </div>
        <Card>
          <CardHeader><CardTitle>Add a task</CardTitle></CardHeader>
          <CardContent>
            <ActionPanel action={createTaskAction} submitLabel="Add task" resetAfter label="Add a task">
              <TextField name="title" label="Task" />
              <TextAreaField name="description" label="Details" rows={2} />
              <TextField name="dueAt" label="Due (IST)" type="datetime-local" />
              <SelectField name="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: p.toLowerCase() }))} defaultValue="NORMAL" />
              {manage ? <SelectField name="assigneeId" label="Assign to" options={staff.map((s) => ({ value: s.id, label: s.name }))} placeholder="Me" /> : null}
            </ActionPanel>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
