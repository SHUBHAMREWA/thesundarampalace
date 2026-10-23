import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { MENU_COURSES } from "@/lib/content/catalog";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import type { PricingRuleInput } from "@/lib/booking/pricing";
import { dateFromKey, dateKey, todayIST } from "@/lib/time";
import {
  checkboxBool,
  dateKeySchema,
  optionalDateKey,
  optionalMoneyString,
  optionalPositiveInt,
  optionalText,
  percentString,
  positiveMoneyString,
  requiredText,
  timeSchema,
} from "@/lib/validation/forms";
import { sacCodeSchema } from "@/lib/validation/gst";
import { assertPermission, type Actor } from "@/server/policies/authorize";

import { recordAudit } from "./audit";
import { fieldError, RuleError } from "./errors";
import { NotFoundError } from "./leads";

/**
 * Booking catalog (catalog.manage): slots, hall buffers and combinations, tax
 * categories and rates, chargeable services, menu packages, pricing rules
 * and cancellation policies. All values come from the business; nothing is
 * hardcoded (CLAUDE.md rule 4).
 */

async function audit(actor: Actor, action: string, entityType: string, entityId: string, summary?: Prisma.InputJsonValue) {
  await recordAudit({ actorId: actor.id, action, entityType, entityId, summary });
}

const sortOrder = z.coerce.number().int().min(0).max(100_000).default(0);

// ─── Halls: buffers, combinations, slots ─────────────────────────────────────

export const hallBookingSchema = z.object({
  setupBufferMinutes: z.coerce.number().int().min(0, "0 or more").max(24 * 60),
  teardownBufferMinutes: z.coerce.number().int().min(0, "0 or more").max(24 * 60),
  isComposite: checkboxBool,
  memberHallIds: z.array(z.string().max(50)).default([]),
});

export async function updateHallBookingRules(actor: Actor, hallId: string, input: z.infer<typeof hallBookingSchema>) {
  assertPermission(actor, "catalog.manage");
  const hall = await db.hall.findUnique({ where: { id: hallId } });
  if (!hall) throw new NotFoundError("Hall");
  const members = input.isComposite ? [...new Set(input.memberHallIds)].filter((id) => id !== hallId) : [];
  if (input.isComposite && members.length < 2) fieldError("memberHallIds", "A combined space needs at least two member halls");
  if (members.length) {
    const found = await db.hall.findMany({ where: { id: { in: members }, isComposite: false } });
    if (found.length !== members.length) fieldError("memberHallIds", "Members must be ordinary (not combined) halls");
  }
  if (input.isComposite && (await db.hallComposition.count({ where: { memberHallId: hallId } }))) {
    fieldError("isComposite", "This hall is part of another combined space, so it can't be a combined space itself");
  }
  await db.$transaction(async (tx) => {
    await tx.hall.update({
      where: { id: hallId },
      data: {
        setupBufferMinutes: input.setupBufferMinutes,
        teardownBufferMinutes: input.teardownBufferMinutes,
        isComposite: input.isComposite,
      },
    });
    await tx.hallComposition.deleteMany({ where: { compositeHallId: hallId } });
    if (members.length) {
      await tx.hallComposition.createMany({ data: members.map((memberHallId) => ({ compositeHallId: hallId, memberHallId })) });
    }
  });
  await audit(actor, "hall.booking_rules_updated", "hall", hallId, {
    setupBufferMinutes: input.setupBufferMinutes,
    teardownBufferMinutes: input.teardownBufferMinutes,
    members,
  });
}

export const slotSchema = z.object({
  hallId: optionalText(50),
  name: requiredText("Slot name", 60),
  startTime: timeSchema,
  endTime: timeSchema,
  sortOrder,
  active: checkboxBool,
});

export async function saveSlot(actor: Actor, id: string | null, input: z.infer<typeof slotSchema>) {
  assertPermission(actor, "catalog.manage");
  if (input.startTime === input.endTime) fieldError("endTime", "A slot can't start and end at the same time");
  if (input.hallId && !(await db.hall.findUnique({ where: { id: input.hallId } }))) fieldError("hallId", "Choose a hall");
  const data = { hallId: input.hallId, name: input.name, startTime: input.startTime, endTime: input.endTime, sortOrder: input.sortOrder, active: input.active };
  const slot = id ? await db.slotDefinition.update({ where: { id }, data }) : await db.slotDefinition.create({ data });
  await audit(actor, id ? "slot.updated" : "slot.created", "slot_definition", slot.id, { name: slot.name, startTime: slot.startTime, endTime: slot.endTime });
  return slot;
}

/** Active slots that apply to a hall (its own plus the all-halls ones). */
export async function slotsForHall(hallId: string) {
  return db.slotDefinition.findMany({
    where: { active: true, OR: [{ hallId }, { hallId: null }] },
    orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
  });
}

// ─── Tax categories and rates ────────────────────────────────────────────────

export const taxCategorySchema = z.object({
  name: requiredText("Name", 80),
  sacCode: sacCodeSchema,
  notes: optionalText(500),
  active: checkboxBool,
});

export const taxRateSchema = z.object({
  ratePercent: percentString,
  effectiveFrom: dateKeySchema,
});

export async function saveTaxCategory(actor: Actor, id: string | null, input: z.infer<typeof taxCategorySchema>, firstRate?: z.infer<typeof taxRateSchema>) {
  assertPermission(actor, "catalog.manage");
  if (!id && !firstRate) throw new RuleError("Enter the GST rate for the new tax category.");
  const saved = await db.$transaction(async (tx) => {
    const category = id
      ? await tx.taxCategory.update({ where: { id }, data: input })
      : await tx.taxCategory.create({ data: input });
    if (!id && firstRate) {
      await tx.taxRate.create({
        data: { taxCategoryId: category.id, ratePercent: firstRate.ratePercent, effectiveFrom: dateFromKey(firstRate.effectiveFrom), createdById: actor.id },
      });
    }
    return category;
  });
  await audit(actor, id ? "tax_category.updated" : "tax_category.created", "tax_category", saved.id, { name: saved.name, sacCode: saved.sacCode, rate: firstRate?.ratePercent ?? null });
  return saved;
}

/** A new rate from a date onwards; earlier quotations and invoices keep theirs. */
export async function addTaxRate(actor: Actor, taxCategoryId: string, input: z.infer<typeof taxRateSchema>) {
  assertPermission(actor, "catalog.manage");
  const category = await db.taxCategory.findUnique({ where: { id: taxCategoryId } });
  if (!category) throw new NotFoundError("Tax category");
  const exists = await db.taxRate.findUnique({ where: { taxCategoryId_effectiveFrom: { taxCategoryId, effectiveFrom: dateFromKey(input.effectiveFrom) } } });
  if (exists) fieldError("effectiveFrom", "A rate already starts on this date");
  await db.taxRate.create({ data: { taxCategoryId, ratePercent: input.ratePercent, effectiveFrom: dateFromKey(input.effectiveFrom), createdById: actor.id } });
  await audit(actor, "tax_rate.added", "tax_category", taxCategoryId, { ratePercent: input.ratePercent, effectiveFrom: input.effectiveFrom });
}

export type TaxInfo = { taxCategoryId: string; name: string; sacCode: string; ratePercent: string };

/** The rate in force on `date` for a category, or null if none starts on/before it. */
export async function taxFor(taxCategoryId: string, date: string = todayIST()): Promise<TaxInfo | null> {
  const category = await db.taxCategory.findUnique({
    where: { id: taxCategoryId },
    include: { rates: { where: { effectiveFrom: { lte: dateFromKey(date) } }, orderBy: { effectiveFrom: "desc" }, take: 1 } },
  });
  const rate = category?.rates[0];
  if (!category || !rate) return null;
  return { taxCategoryId: category.id, name: category.name, sacCode: category.sacCode, ratePercent: rate.ratePercent.toFixed(2) };
}

export async function taxCategoriesWithRates() {
  const today = dateFromKey(todayIST());
  const rows = await db.taxCategory.findMany({ orderBy: { name: "asc" }, include: { rates: { orderBy: { effectiveFrom: "desc" } } } });
  return rows.map((row) => ({ ...row, currentRate: row.rates.find((r) => r.effectiveFrom <= today) ?? null }));
}

// ─── Chargeable services ─────────────────────────────────────────────────────

export const serviceItemSchema = z.object({
  name: requiredText("Name", 120),
  categoryKey: requiredText("Category", 50),
  description: optionalText(500),
  unit: requiredText("Unit", 40),
  defaultPrice: optionalMoneyString,
  taxCategoryId: requiredText("Tax category", 50),
  sortOrder,
  active: checkboxBool,
});

export async function saveServiceItem(actor: Actor, id: string | null, input: z.infer<typeof serviceItemSchema>) {
  assertPermission(actor, "catalog.manage");
  const category = await db.lookupValue.findFirst({ where: { listKey: "service_category", key: input.categoryKey } });
  if (!category) fieldError("categoryKey", "Choose a category");
  if (!(await db.taxCategory.findUnique({ where: { id: input.taxCategoryId } }))) fieldError("taxCategoryId", "Choose a tax category");
  const item = id ? await db.serviceItem.update({ where: { id }, data: input }) : await db.serviceItem.create({ data: input });
  await audit(actor, id ? "service_item.updated" : "service_item.created", "service_item", item.id, { name: item.name, defaultPrice: item.defaultPrice?.toFixed(2) ?? null });
  return item;
}

// ─── Menu packages ───────────────────────────────────────────────────────────

export const selectionRuleSchema = z.object({
  course: z.enum(MENU_COURSES),
  choose: z.coerce.number().int().min(1).max(50),
});
export type SelectionRule = z.infer<typeof selectionRuleSchema>;

export const menuPackageSchema = z.object({
  menuId: requiredText("Menu", 50),
  name: requiredText("Name", 120),
  perPlateRate: positiveMoneyString("the per-plate rate"),
  minPlates: optionalPositiveInt(100_000),
  taxCategoryId: requiredText("Tax category", 50),
  selectionRules: z.array(selectionRuleSchema).max(20),
  sortOrder,
  active: checkboxBool,
});

export async function saveMenuPackage(actor: Actor, id: string | null, input: z.infer<typeof menuPackageSchema>) {
  assertPermission(actor, "catalog.manage");
  const menu = await db.menu.findUnique({ where: { id: input.menuId }, include: { items: { select: { course: true } } } });
  if (!menu) fieldError("menuId", "Choose a menu");
  if (!(await db.taxCategory.findUnique({ where: { id: input.taxCategoryId } }))) fieldError("taxCategoryId", "Choose a tax category");
  for (const [index, rule] of input.selectionRules.entries()) {
    const available = menu.items.filter((i) => i.course === rule.course).length;
    if (rule.choose > available) fieldError(`selectionRules.${index}.choose`, `The menu has only ${available} item(s) in this course`);
  }
  const data = { ...input, selectionRules: input.selectionRules as unknown as Prisma.InputJsonValue };
  const saved = id ? await db.menuPackage.update({ where: { id }, data }) : await db.menuPackage.create({ data });
  await audit(actor, id ? "menu_package.updated" : "menu_package.created", "menu_package", saved.id, { name: saved.name, perPlateRate: saved.perPlateRate.toFixed(2) });
  return saved;
}

export function parseSelectionRules(value: unknown): SelectionRule[] {
  const parsed = z.array(selectionRuleSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

// ─── CRM package pricing ─────────────────────────────────────────────────────

export const packagePricingSchema = z.object({
  crmPrice: optionalMoneyString,
  perPlateRate: optionalMoneyString,
  minPlates: optionalPositiveInt(100_000),
  taxCategoryId: optionalText(50),
  active: checkboxBool,
});

export async function savePackagePricing(actor: Actor, packageId: string, input: z.infer<typeof packagePricingSchema>) {
  assertPermission(actor, "catalog.manage");
  if (!(await db.package.findUnique({ where: { id: packageId } }))) throw new NotFoundError("Package");
  if ((input.crmPrice || input.perPlateRate) && !input.taxCategoryId) fieldError("taxCategoryId", "Choose the tax category for this package");
  await db.package.update({ where: { id: packageId }, data: input });
  await audit(actor, "package.pricing_updated", "package", packageId, { crmPrice: input.crmPrice, perPlateRate: input.perPlateRate });
}

// ─── Pricing rules ───────────────────────────────────────────────────────────

export const pricingRuleSchema = z
  .object({
    name: requiredText("Name", 120),
    kind: z.enum(["SEASON", "WEEKDAY", "DATE"]),
    startDate: optionalDateKey,
    endDate: optionalDateKey,
    weekdays: z.array(z.coerce.number().int().min(0).max(6)).default([]),
    dates: z
      .string()
      .optional()
      .transform((v) => (v ?? "").split(/[\s,]+/).map((d) => d.trim()).filter(Boolean)),
    adjustmentType: z.enum(["PERCENT", "AMOUNT"]),
    adjustmentValue: z
      .string()
      .trim()
      .regex(/^-?\d{1,8}(\.\d{1,2})?$/, "Enter a number, e.g. 10 or -5"),
    appliesTo: z.enum(["ALL", "PLATES", "PACKAGE", "SERVICE"]),
    sortOrder,
    active: checkboxBool,
  })
  .superRefine((v, ctx) => {
    if (v.kind === "SEASON") {
      if (!v.startDate) ctx.addIssue({ code: "custom", path: ["startDate"], message: "Choose the first day" });
      if (!v.endDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Choose the last day" });
      if (v.startDate && v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ends before it starts" });
    }
    if (v.kind === "WEEKDAY" && !v.weekdays.length) ctx.addIssue({ code: "custom", path: ["weekdays"], message: "Choose at least one day" });
    if (v.kind === "DATE") {
      if (!v.dates.length) ctx.addIssue({ code: "custom", path: ["dates"], message: "Enter at least one date" });
      if (v.dates.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d))) ctx.addIssue({ code: "custom", path: ["dates"], message: "Use YYYY-MM-DD dates separated by commas" });
    }
    if (v.adjustmentType === "PERCENT" && money(v.adjustmentValue).abs().greaterThan(100)) {
      ctx.addIssue({ code: "custom", path: ["adjustmentValue"], message: "Between -100 and 100" });
    }
  });

export async function savePricingRule(actor: Actor, id: string | null, input: z.infer<typeof pricingRuleSchema>) {
  assertPermission(actor, "catalog.manage");
  const data = {
    name: input.name,
    kind: input.kind,
    startDate: input.kind === "SEASON" && input.startDate ? dateFromKey(input.startDate) : null,
    endDate: input.kind === "SEASON" && input.endDate ? dateFromKey(input.endDate) : null,
    weekdays: input.kind === "WEEKDAY" ? input.weekdays : undefined,
    dates: input.kind === "DATE" ? input.dates : undefined,
    adjustmentType: input.adjustmentType,
    adjustmentValue: input.adjustmentValue,
    appliesTo: input.appliesTo,
    sortOrder: input.sortOrder,
    active: input.active,
  };
  const rule = id ? await db.pricingRule.update({ where: { id }, data }) : await db.pricingRule.create({ data });
  await audit(actor, id ? "pricing_rule.updated" : "pricing_rule.created", "pricing_rule", rule.id, { name: rule.name, kind: rule.kind, value: rule.adjustmentValue.toFixed(2) });
  return rule;
}

export async function activePricingRules(): Promise<PricingRuleInput[]> {
  const rows = await db.pricingRule.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    startDate: r.startDate ? dateKey(r.startDate) : null,
    endDate: r.endDate ? dateKey(r.endDate) : null,
    weekdays: Array.isArray(r.weekdays) ? (r.weekdays as number[]) : null,
    dates: Array.isArray(r.dates) ? (r.dates as string[]) : null,
    adjustmentType: r.adjustmentType,
    adjustmentValue: r.adjustmentValue.toFixed(2),
    appliesTo: r.appliesTo as PricingRuleInput["appliesTo"],
    active: r.active,
  }));
}

// ─── Cancellation policies ───────────────────────────────────────────────────

export const slabSchema = z.object({
  daysBeforeEventMin: z.coerce.number().int().min(0).max(1000),
  refundPercent: percentString,
});

export const cancellationPolicySchema = z.object({
  name: requiredText("Name", 120),
  description: optionalText(1000),
  slabs: z
    .array(slabSchema)
    .min(1, "Add at least one slab")
    .max(10)
    .refine((slabs) => new Set(slabs.map((s) => s.daysBeforeEventMin)).size === slabs.length, "Each slab needs a different number of days"),
  active: checkboxBool,
});

export async function saveCancellationPolicy(actor: Actor, id: string | null, input: z.infer<typeof cancellationPolicySchema>) {
  assertPermission(actor, "catalog.manage");
  const slabs = [...input.slabs].sort((a, b) => b.daysBeforeEventMin - a.daysBeforeEventMin);
  const data = { name: input.name, description: input.description, slabs: slabs as unknown as Prisma.InputJsonValue, active: input.active };
  const policy = id ? await db.cancellationPolicy.update({ where: { id }, data }) : await db.cancellationPolicy.create({ data });
  // Bookings already confirmed keep the snapshot taken at confirmation.
  await audit(actor, id ? "cancellation_policy.updated" : "cancellation_policy.created", "cancellation_policy", policy.id, { name: policy.name, slabs: data.slabs });
  return policy;
}

export function parseSlabs(value: unknown) {
  const parsed = z.array(slabSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
