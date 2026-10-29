import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { istToUtc, todayIST } from "@/lib/time";
import { optionalText, requiredText } from "@/lib/validation/forms";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";

import { recordActivity } from "./activity";
import { fieldError } from "./errors";
import { NotFoundError } from "./leads";
import { notifyStaff } from "./notifications";

/**
 * Tasks (MASTER_PROMPT §15). `tasks.manage` sees and assigns every task;
 * `tasks.own` sees tasks assigned to or created by them and
 * can move them along.
 */

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

export function taskVisibility(actor: Actor): Prisma.TaskWhereInput {
  if (can(actor, "tasks.manage")) return {};
  assertPermission(actor, "tasks.own");
  return { OR: [{ assigneeId: actor.id }, { createdById: actor.id }] };
}

/** "YYYY-MM-DDTHH:mm" from <input type="datetime-local"> (IST) → UTC. */
const optionalDueAt = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}))?/.exec(v);
    if (!m) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date" });
      return z.NEVER;
    }
    return istToUtc(m[1], m[2] ?? "18:00");
  });

export const taskSchema = z.object({
  title: requiredText("Title", 200),
  description: optionalText(2000),
  assigneeId: optionalText(50),
  dueAt: optionalDueAt,
  priority: z.enum(PRIORITIES).default("NORMAL"),
  bookingId: optionalText(50),
  leadId: optionalText(50),
});

export const taskListQuerySchema = z.object({
  view: z.enum(["mine", "all", "overdue", "done"]).default("mine").catch("mine"),
  assignee: z.string().max(50).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export const TASK_PAGE_SIZE = 30;

export async function listTasks(actor: Actor, query: z.infer<typeof taskListQuerySchema>, now: Date = new Date()) {
  const and: Prisma.TaskWhereInput[] = [taskVisibility(actor)];
  if (query.view === "mine") and.push({ assigneeId: actor.id, status: { in: ["OPEN", "IN_PROGRESS"] } });
  if (query.view === "all") and.push({ status: { in: ["OPEN", "IN_PROGRESS"] } });
  if (query.view === "overdue") and.push({ status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lt: now } });
  if (query.view === "done") and.push({ status: { in: ["DONE", "CANCELLED"] } });
  if (query.assignee && can(actor, "tasks.manage")) and.push({ assigneeId: query.assignee === "none" ? null : query.assignee });
  const where = { AND: and };
  const [total, rows] = await Promise.all([
    db.task.count({ where }),
    db.task.findMany({
      where,
      orderBy: query.view === "done" ? [{ completedAt: "desc" }, { updatedAt: "desc" }] : [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      skip: (query.page - 1) * TASK_PAGE_SIZE,
      take: TASK_PAGE_SIZE,
      include: { assignee: { select: { id: true, name: true } }, booking: { select: { id: true, reference: true, mainEventName: true } }, lead: { select: { id: true, reference: true } } },
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / TASK_PAGE_SIZE)) };
}

async function assertAssignable(assigneeId: string | null) {
  if (!assigneeId) return;
  const user = await db.user.findFirst({ where: { id: assigneeId, active: true, roles: { some: { role: { permissions: { some: { permissionKey: "tasks.own" } } } } } } });
  if (!user) fieldError("assigneeId", "Choose an active staff member who can receive tasks");
}

export async function createTask(actor: Actor, input: z.infer<typeof taskSchema>) {
  // Anyone with tasks.own may note a task for themselves; assigning others needs tasks.manage.
  assertPermission(actor, "tasks.own");
  const assigneeId = input.assigneeId ?? actor.id;
  if (assigneeId !== actor.id) assertPermission(actor, "tasks.manage");
  await assertAssignable(assigneeId);
  if (input.bookingId && !(await db.booking.findFirst({ where: { id: input.bookingId, deletedAt: null } }))) fieldError("bookingId", "Unknown booking");
  const task = await db.$transaction(async (tx) => {
    const created = await tx.task.create({ data: { ...input, assigneeId, createdById: actor.id } });
    if (assigneeId !== actor.id) {
      await notifyStaff(tx, { userIds: [assigneeId], kind: "task.assigned", title: `New task: ${input.title}`, link: "/admin/tasks" });
    }
    if (input.bookingId) await recordActivity({ entityType: "booking", entityId: input.bookingId, actorId: actor.id, kind: "TASK", message: `Task added: ${input.title}` }, tx);
    return created;
  });
  return task;
}

async function requireTask(actor: Actor, id: string) {
  const task = await db.task.findFirst({ where: { AND: [{ id }, taskVisibility(actor)] } });
  if (!task) throw new NotFoundError("Task");
  return task;
}

export async function updateTask(actor: Actor, id: string, input: z.infer<typeof taskSchema>) {
  const task = await requireTask(actor, id);
  const assigneeId = input.assigneeId ?? task.assigneeId;
  if (assigneeId !== task.assigneeId || (task.createdById !== actor.id && !can(actor, "tasks.manage"))) assertPermission(actor, "tasks.manage");
  await assertAssignable(assigneeId);
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: { ...input, assigneeId } });
    if (assigneeId && assigneeId !== task.assigneeId && assigneeId !== actor.id) {
      await notifyStaff(tx, { userIds: [assigneeId], kind: "task.assigned", title: `Task assigned to you: ${input.title}`, link: "/admin/tasks" });
    }
  });
}

export async function setTaskStatus(actor: Actor, id: string, status: (typeof STATUSES)[number]) {
  const task = await requireTask(actor, id);
  if (task.assigneeId !== actor.id && task.createdById !== actor.id) assertPermission(actor, "tasks.manage");
  const done = status === "DONE";
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: { status, completedAt: done ? new Date() : null, completedById: done ? actor.id : null } });
    if (task.bookingId && (status === "DONE" || status === "CANCELLED")) {
      await recordActivity({ entityType: "booking", entityId: task.bookingId, actorId: actor.id, kind: "TASK", message: `Task ${status === "DONE" ? "done" : "cancelled"}: ${task.title}` }, tx);
    }
  });
}

export async function bookingTasks(actor: Actor, bookingId: string) {
  if (!can(actor, "tasks.own") && !can(actor, "tasks.manage")) return [];
  return db.task.findMany({
    where: { AND: [{ bookingId }, can(actor, "bookings.read") ? {} : taskVisibility(actor)] },
    orderBy: [{ status: "asc" }, { dueAt: { sort: "asc", nulls: "last" } }],
    include: { assignee: { select: { name: true } } },
  });
}

/** Overdue and due-today counts for dashboards. */
export async function taskCounts(actor: Actor, now: Date = new Date()) {
  const visible = taskVisibility(actor);
  const endOfToday = istToUtc(todayIST(now), "23:59");
  const [mineOpen, overdue, dueToday] = await Promise.all([
    db.task.count({ where: { AND: [visible, { assigneeId: actor.id, status: { in: ["OPEN", "IN_PROGRESS"] } }] } }),
    db.task.count({ where: { AND: [visible, { assigneeId: actor.id, status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { lt: now } }] } }),
    db.task.count({ where: { AND: [visible, { assigneeId: actor.id, status: { in: ["OPEN", "IN_PROGRESS"] }, dueAt: { gte: now, lte: endOfToday } }] } }),
  ]);
  return { mineOpen, overdue, dueToday };
}

