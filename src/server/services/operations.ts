import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { dateFromKey, dateKey } from "@/lib/time";
import { checkboxBool, dateKeySchema, optionalEmail, optionalPhone, optionalText, positiveMoneyString, requiredText } from "@/lib/validation/forms";
import { assertPermission, type Actor } from "@/server/policies/authorize";

import { recordActivity } from "./activity";
import { recordAudit } from "./audit";
import { bookingVisibility } from "./bookings";
import { fieldError } from "./errors";
import { NotFoundError } from "./leads";

/** Vendors, vendor assignments and expenses (MASTER_PROMPT §15). */

async function lookupExists(listKey: string, key: string) {
  return !!(await db.lookupValue.findFirst({ where: { listKey, key } }));
}

// ─── Vendors ─────────────────────────────────────────────────────────────────

export const vendorSchema = z.object({
  name: requiredText("Name", 160),
  categoryKey: requiredText("Category", 50),
  contactName: optionalText(120),
  phone: optionalPhone,
  email: optionalEmail,
  partner: checkboxBool,
  notes: optionalText(2000),
  active: checkboxBool,
});

export async function listVendors(actor: Actor, query: { q?: string; category?: string; includeInactive?: boolean }) {
  assertPermission(actor, "vendors.read");
  return db.vendor.findMany({
    where: {
      ...(query.includeInactive ? {} : { active: true }),
      ...(query.category ? { categoryKey: query.category } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { contactName: { contains: query.q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ partner: "desc" }, { name: "asc" }],
    include: { _count: { select: { assignments: true } } },
  });
}

export async function saveVendor(actor: Actor, id: string | null, input: z.infer<typeof vendorSchema>) {
  assertPermission(actor, "vendors.manage");
  if (!(await lookupExists("vendor_category", input.categoryKey))) fieldError("categoryKey", "Choose a category");
  const vendor = id ? await db.vendor.update({ where: { id }, data: input }) : await db.vendor.create({ data: input });
  await recordAudit({ actorId: actor.id, action: id ? "vendor.updated" : "vendor.created", entityType: "vendor", entityId: vendor.id, summary: { name: vendor.name } });
  return vendor;
}

export const assignmentSchema = z.object({
  vendorId: requiredText("Vendor", 50),
  subEventId: optionalText(50),
  service: requiredText("What they provide", 200),
  notes: optionalText(1000),
});

export async function assignVendor(actor: Actor, bookingId: string, input: z.infer<typeof assignmentSchema>) {
  assertPermission(actor, "vendors.manage");
  const booking = await db.booking.findFirst({ where: { AND: [{ id: bookingId }, bookingVisibility(actor)] } });
  if (!booking) throw new NotFoundError("Booking");
  const vendor = await db.vendor.findFirst({ where: { id: input.vendorId, active: true } });
  if (!vendor) fieldError("vendorId", "Choose an active vendor");
  if (input.subEventId && !(await db.bookingSubEvent.findFirst({ where: { id: input.subEventId, bookingId } }))) fieldError("subEventId", "Choose one of this booking's functions");
  await db.$transaction(async (tx) => {
    await tx.vendorAssignment.create({ data: { ...input, bookingId, createdById: actor.id } });
    await recordActivity({ entityType: "booking", entityId: bookingId, actorId: actor.id, kind: "VENDOR", message: `Vendor assigned: ${vendor.name} — ${input.service}` }, tx);
  });
}

export async function removeVendorAssignment(actor: Actor, assignmentId: string) {
  assertPermission(actor, "vendors.manage");
  const assignment = await db.vendorAssignment.findUnique({ where: { id: assignmentId }, include: { vendor: true } });
  if (!assignment) throw new NotFoundError("Assignment");
  await db.$transaction(async (tx) => {
    await tx.vendorAssignment.delete({ where: { id: assignmentId } });
    await recordActivity({ entityType: "booking", entityId: assignment.bookingId, actorId: actor.id, kind: "VENDOR", message: `Vendor removed: ${assignment.vendor.name}` }, tx);
  });
}

export async function bookingVendors(actor: Actor, bookingId: string) {
  assertPermission(actor, "vendors.read");
  return db.vendorAssignment.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" }, include: { vendor: true } });
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export const expenseSchema = z.object({
  bookingId: optionalText(50),
  categoryKey: requiredText("Category", 50),
  vendorId: optionalText(50),
  description: requiredText("Description", 300),
  amount: positiveMoneyString("the amount"),
  incurredOn: dateKeySchema,
  paymentStatus: z.enum(["UNPAID", "PARTLY_PAID", "PAID"]).default("UNPAID"),
  notes: optionalText(1000),
});

export const expenseListQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  category: z.string().max(50).optional().catch(undefined),
  booking: z.string().max(50).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export const EXPENSE_PAGE_SIZE = 30;

export function expenseWhere(query: z.infer<typeof expenseListQuerySchema>): Prisma.ExpenseWhereInput {
  return {
    deletedAt: null,
    ...(query.from || query.to ? { incurredOn: { ...(query.from ? { gte: dateFromKey(query.from) } : {}), ...(query.to ? { lte: dateFromKey(query.to) } : {}) } } : {}),
    ...(query.category ? { categoryKey: query.category } : {}),
    ...(query.booking ? { booking: { reference: query.booking.toUpperCase() } } : {}),
  };
}

export async function listExpenses(actor: Actor, query: z.infer<typeof expenseListQuerySchema>) {
  assertPermission(actor, "expenses.manage");
  const where = expenseWhere(query);
  const [total, sum, rows] = await Promise.all([
    db.expense.count({ where }),
    db.expense.aggregate({ where, _sum: { amount: true } }),
    db.expense.findMany({
      where,
      orderBy: [{ incurredOn: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * EXPENSE_PAGE_SIZE,
      take: EXPENSE_PAGE_SIZE,
      include: { booking: { select: { id: true, reference: true } }, vendor: { select: { id: true, name: true } } },
    }),
  ]);
  return { total, sum: sum._sum.amount?.toFixed(2) ?? "0.00", rows, pageCount: Math.max(1, Math.ceil(total / EXPENSE_PAGE_SIZE)) };
}

async function validateExpense(input: z.infer<typeof expenseSchema>) {
  if (!(await lookupExists("expense_category", input.categoryKey))) fieldError("categoryKey", "Choose a category");
  if (input.vendorId && !(await db.vendor.findUnique({ where: { id: input.vendorId } }))) fieldError("vendorId", "Choose a vendor");
  if (input.bookingId && !(await db.booking.findFirst({ where: { id: input.bookingId, deletedAt: null } }))) fieldError("bookingId", "Unknown booking");
}

function expenseData(input: z.infer<typeof expenseSchema>) {
  return { ...input, incurredOn: dateFromKey(input.incurredOn) };
}

export async function createExpense(actor: Actor, input: z.infer<typeof expenseSchema>) {
  assertPermission(actor, "expenses.manage");
  await validateExpense(input);
  const expense = await db.$transaction(async (tx) => {
    const created = await tx.expense.create({ data: { ...expenseData(input), recordedById: actor.id } });
    await recordAudit({ actorId: actor.id, action: "expense.created", entityType: "expense", entityId: created.id, summary: { amount: input.amount, category: input.categoryKey, booking: input.bookingId } }, tx);
    if (input.bookingId) await recordActivity({ entityType: "booking", entityId: input.bookingId, actorId: actor.id, kind: "EXPENSE", message: `Expense recorded: ${input.description} ${formatINR(input.amount)}` }, tx);
    return created;
  });
  return expense;
}

/** Expenses are operational records: edits are allowed, with before/after in the audit log. */
export async function updateExpense(actor: Actor, id: string, input: z.infer<typeof expenseSchema>) {
  assertPermission(actor, "expenses.manage");
  const before = await db.expense.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new NotFoundError("Expense");
  await validateExpense(input);
  await db.$transaction(async (tx) => {
    await tx.expense.update({ where: { id }, data: expenseData(input) });
    await recordAudit(
      {
        actorId: actor.id,
        action: "expense.updated",
        entityType: "expense",
        entityId: id,
        summary: {
          before: { amount: before.amount.toFixed(2), incurredOn: dateKey(before.incurredOn), status: before.paymentStatus, description: before.description },
          after: { amount: input.amount, incurredOn: input.incurredOn, status: input.paymentStatus, description: input.description },
        },
      },
      tx,
    );
  });
}

export async function deleteExpense(actor: Actor, id: string, reason: string) {
  assertPermission(actor, "expenses.manage");
  if (!reason.trim()) fieldError("reason", "Give a reason");
  const expense = await db.expense.findFirst({ where: { id, deletedAt: null } });
  if (!expense) throw new NotFoundError("Expense");
  await db.$transaction(async (tx) => {
    await tx.expense.update({ where: { id }, data: { deletedAt: new Date(), deletedReason: reason.slice(0, 500) } });
    await recordAudit({ actorId: actor.id, action: "expense.deleted", entityType: "expense", entityId: id, summary: { amount: expense.amount.toFixed(2), reason: reason.slice(0, 500) } }, tx);
  });
}
