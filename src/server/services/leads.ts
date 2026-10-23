import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { istToUtc } from "@/lib/time";
import { assertPermission, can, ForbiddenError, type Actor } from "@/server/policies/authorize";

import { recordAudit } from "./audit";
import { notifyStaff } from "./notifications";

/**
 * Leads CRM (MASTER_PROMPT §7). Visibility: `leads.read_all` sees every lead;
 * `leads.read` sees leads assigned to them plus unassigned ones.
 */

export class NotFoundError extends Error {
  constructor(what = "Record") {
    super(`${what} not found`);
    this.name = "NotFoundError";
  }
}

export function leadVisibility(actor: Actor): Prisma.LeadWhereInput {
  assertPermission(actor, "leads.read");
  if (can(actor, "leads.read_all")) return { deletedAt: null };
  return { deletedAt: null, OR: [{ assignedToId: actor.id }, { assignedToId: null }] };
}

export const LEAD_PAGE_SIZE = 25;

export const leadListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.string().max(50).optional().catch(undefined),
  source: z.string().max(50).optional().catch(undefined),
  assigned: z.string().max(50).optional().catch(undefined), // "me" | "none" | userId
  followUp: z.enum(["due", "overdue"]).optional().catch(undefined),
  sort: z.enum(["newest", "oldest", "follow_up", "activity"]).default("newest").catch("newest"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;

function endOfTodayIST(now: Date): Date {
  const ist = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
  return new Date(`${ist}T23:59:59.999+05:30`);
}

export async function listLeads(actor: Actor, query: LeadListQuery, now: Date = new Date()) {
  const where: Prisma.LeadWhereInput = { AND: [leadVisibility(actor)] };
  const and = where.AND as Prisma.LeadWhereInput[];
  if (query.q) {
    const digits = query.q.replace(/\D/g, "");
    and.push({
      OR: [
        { fullName: { contains: query.q, mode: "insensitive" } },
        { reference: { contains: query.q.toUpperCase() } },
        ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
        { email: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  if (query.status) and.push({ statusKey: query.status });
  if (query.source) and.push({ sourceKey: query.source });
  if (query.assigned === "me") and.push({ assignedToId: actor.id });
  else if (query.assigned === "none") and.push({ assignedToId: null });
  else if (query.assigned) and.push({ assignedToId: query.assigned });
  if (query.followUp === "due") and.push({ followUpAt: { lte: endOfTodayIST(now) } });
  if (query.followUp === "overdue") and.push({ followUpAt: { lt: now } });

  const orderBy: Prisma.LeadOrderByWithRelationInput[] =
    query.sort === "oldest"
      ? [{ createdAt: "asc" }]
      : query.sort === "follow_up"
        ? [{ followUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }]
        : query.sort === "activity"
          ? [{ lastActivityAt: "desc" }]
          : [{ createdAt: "desc" }];

  const [total, rows] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * LEAD_PAGE_SIZE,
      take: LEAD_PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        fullName: true,
        phone: true,
        statusKey: true,
        sourceKey: true,
        eventTypeKey: true,
        preferredDate: true,
        followUpAt: true,
        createdAt: true,
        assignedTo: { select: { id: true, name: true } },
      },
    }),
  ]);
  return { total, rows, pageCount: Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE)) };
}

export async function getLead(actor: Actor, id: string) {
  const lead = await db.lead.findFirst({
    where: { AND: [{ id }, leadVisibility(actor)] },
    include: {
      assignedTo: { select: { id: true, name: true } },
      preferredHall: { select: { id: true, name: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!lead) throw new NotFoundError("Lead");
  const actorIds = [...new Set(lead.activities.map((a) => a.actorId).filter((v): v is string => !!v))];
  const actors = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const consent = await db.consentRecord.findFirst({
    where: { subjectType: "LEAD", subjectId: lead.id, purpose: "contact" },
    orderBy: { createdAt: "desc" },
  });
  return { lead, actorNames: new Map(actors.map((a) => [a.id, a.name])), consent };
}

async function requireLead(actor: Actor, id: string) {
  const lead = await db.lead.findFirst({ where: { AND: [{ id }, leadVisibility(actor)] } });
  if (!lead) throw new NotFoundError("Lead");
  return lead;
}

async function lookupKeys(listKey: string): Promise<Map<string, string | null>> {
  const rows = await db.lookupValue.findMany({ where: { listKey, active: true }, select: { key: true, systemKey: true } });
  return new Map(rows.map((r) => [r.key, r.systemKey]));
}

export const statusChangeSchema = z.object({
  statusKey: z.string().min(1).max(50),
  lostReasonKey: z.string().max(50).optional().transform((v) => (v ? v : undefined)),
  note: z.string().trim().max(2000).optional().transform((v) => (v ? v : undefined)),
});

export async function changeLeadStatus(actor: Actor, id: string, input: z.infer<typeof statusChangeSchema>) {
  assertPermission(actor, "leads.edit");
  const lead = await requireLead(actor, id);
  const statuses = await lookupKeys("lead_status");
  if (!statuses.has(input.statusKey)) throw new z.ZodError([{ code: "custom", path: ["statusKey"], message: "Unknown status", input: input.statusKey }]);
  const isLost = statuses.get(input.statusKey) === "LOST";
  if (isLost) {
    const reasons = await lookupKeys("lost_reason");
    if (!input.lostReasonKey || !reasons.has(input.lostReasonKey)) {
      throw new z.ZodError([{ code: "custom", path: ["lostReasonKey"], message: "Choose why the lead was lost", input: input.lostReasonKey }]);
    }
  }
  const now = new Date();
  await db.$transaction([
    db.lead.update({
      where: { id: lead.id },
      data: { statusKey: input.statusKey, lostReasonKey: isLost ? input.lostReasonKey : null, lastActivityAt: now },
    }),
    db.leadActivity.create({
      data: {
        leadId: lead.id,
        kind: "STATUS_CHANGE",
        actorId: actor.id,
        note: input.note ?? null,
        data: { from: lead.statusKey, to: input.statusKey, lostReasonKey: isLost ? input.lostReasonKey : null },
      },
    }),
  ]);
}

export async function assignLead(actor: Actor, id: string, assigneeId: string | null) {
  assertPermission(actor, "leads.assign");
  const lead = await requireLead(actor, id);
  if (assigneeId) {
    const assignee = await db.user.findFirst({
      where: {
        id: assigneeId,
        active: true,
        roles: { some: { role: { permissions: { some: { permissionKey: "leads.read" } } } } },
      },
    });
    if (!assignee) throw new z.ZodError([{ code: "custom", path: ["assigneeId"], message: "Choose an active staff member who can work on leads", input: assigneeId }]);
  }
  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: { assignedToId: assigneeId, lastActivityAt: new Date() } });
    await tx.leadActivity.create({
      data: { leadId: lead.id, kind: "ASSIGNED", actorId: actor.id, data: { from: lead.assignedToId, to: assigneeId } },
    });
    if (assigneeId && assigneeId !== actor.id) {
      await notifyStaff(tx, {
        userIds: [assigneeId],
        kind: "lead.assigned",
        title: `Lead ${lead.reference} assigned to you`,
        link: `/admin/leads/${lead.id}`,
      });
    }
  });
}

export const activitySchema = z.object({
  kind: z.enum(["CALL", "WHATSAPP", "VISIT", "NOTE"]),
  note: z.string().trim().min(1, "Write a short note").max(2000),
});

export async function addLeadActivity(actor: Actor, id: string, input: z.infer<typeof activitySchema>) {
  assertPermission(actor, "leads.edit");
  const lead = await requireLead(actor, id);
  await db.$transaction([
    db.leadActivity.create({ data: { leadId: lead.id, kind: input.kind, note: input.note, actorId: actor.id } }),
    db.lead.update({ where: { id: lead.id }, data: { lastActivityAt: new Date() } }),
  ]);
}

/** <input type="datetime-local"> values are Asia/Kolkata wall-clock times. */
const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(v);
    if (!m) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
      return z.NEVER;
    }
    return istToUtc(m[1], m[2]);
  });

export const leadDetailsSchema = z.object({
  email: z.union([z.literal(""), z.email("Enter a valid email")]).optional().transform((v) => (v ? v : null)),
  eventTypeKey: z.string().max(50).optional().transform((v) => (v ? v : null)),
  preferredDate: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null)),
  guestsApprox: z
    .union([z.literal(""), z.coerce.number().int().min(1, "Enter a positive number").max(100_000)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  budgetEstimate: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{1,10}(\.\d{1,2})?$/.test(v), "Enter an amount in rupees, e.g. 250000")
    .transform((v) => (v ? money(v).toFixed(2) : null)),
  menuPreference: z.enum(["", "veg", "jain", "non_veg"]).optional().transform((v) => (v ? v : null)),
  preferredHallId: z.string().max(50).optional().transform((v) => (v ? v : null)),
  followUpAt: optionalDate,
  siteVisitAt: optionalDate,
  siteVisitOutcome: z.string().trim().max(1000).optional().transform((v) => (v ? v : null)),
});

export async function updateLeadDetails(actor: Actor, id: string, input: z.infer<typeof leadDetailsSchema>) {
  assertPermission(actor, "leads.edit");
  const lead = await requireLead(actor, id);
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  const compare = (key: string, from: unknown, to: unknown) => {
    const a = from instanceof Date ? from.toISOString() : from === null || from === undefined ? null : String(from);
    const b = to instanceof Date ? to.toISOString() : to === null || to === undefined ? null : String(to);
    if (a !== b) changed[key] = { from: a, to: b };
  };
  compare("email", lead.email, input.email);
  compare("eventTypeKey", lead.eventTypeKey, input.eventTypeKey);
  compare("preferredDate", lead.preferredDate, input.preferredDate);
  compare("guestsApprox", lead.guestsApprox, input.guestsApprox);
  compare("budgetEstimate", lead.budgetEstimate?.toFixed(2) ?? null, input.budgetEstimate);
  compare("menuPreference", lead.menuPreference, input.menuPreference);
  compare("preferredHallId", lead.preferredHallId, input.preferredHallId);
  compare("followUpAt", lead.followUpAt, input.followUpAt);
  compare("siteVisitAt", lead.siteVisitAt, input.siteVisitAt);
  compare("siteVisitOutcome", lead.siteVisitOutcome, input.siteVisitOutcome);
  if (!Object.keys(changed).length) return;
  await db.$transaction([
    db.lead.update({
      where: { id: lead.id },
      data: { ...input, budgetEstimate: input.budgetEstimate, lastActivityAt: new Date() },
    }),
    db.leadActivity.create({
      data: { leadId: lead.id, kind: "UPDATED", actorId: actor.id, data: changed as Prisma.InputJsonValue },
    }),
  ]);
}

/** Soft delete (e.g. spam). Requires lead assignment rights; recorded in the audit log. */
export async function archiveLead(actor: Actor, id: string, reason: string) {
  assertPermission(actor, "leads.assign");
  const lead = await requireLead(actor, id);
  if (!reason.trim()) throw new z.ZodError([{ code: "custom", path: ["reason"], message: "Give a reason", input: reason }]);
  await db.lead.update({ where: { id: lead.id }, data: { deletedAt: new Date() } });
  await recordAudit({ actorId: actor.id, action: "lead.archived", entityType: "lead", entityId: lead.id, summary: { reason: reason.slice(0, 500) } });
}

/** Staff who can be assigned leads. */
export async function assignableStaff() {
  return db.user.findMany({
    where: { active: true, roles: { some: { role: { permissions: { some: { permissionKey: "leads.read" } } } } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export function canSeeAll(actor: Actor): boolean {
  return can(actor, "leads.read_all");
}

export { ForbiddenError };
