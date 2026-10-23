import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { applyPricingRules, type PricingTarget } from "@/lib/booking/pricing";
import { computeQuote, supplyTypeFor, type SupplyType } from "@/lib/money";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { addDays, dateFromKey, dateKey, formatDateKey, todayIST } from "@/lib/time";
import {
  checkboxBool,
  moneyString,
  optionalDateKey,
  optionalText,
  quantityString,
  requiredText,
} from "@/lib/validation/forms";
import { isGstStateCode } from "@/lib/validation/gst";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";

import { recordActivity } from "./activity";
import { recordAudit } from "./audit";
import { bookingVisibility, changeBookingStatus, type MenuSnapshot } from "./bookings";
import { activePricingRules, taxFor } from "./catalog";
import { fieldError, RuleError } from "./errors";
import { NotFoundError } from "./leads";
import { getSettings } from "./settings";

/**
 * Quotation versions (MASTER_PROMPT §12). A draft is edited freely; once
 * SENT it is immutable (database trigger) and changes create the next
 * version. Exactly one version is ACCEPTED; the booking's price follows it.
 * Totals are always computed here from the lines, never typed in.
 */

type Tx = Prisma.TransactionClient;

async function requireVersion(actor: Actor, versionId: string) {
  const version = await db.quotationVersion.findUnique({ where: { id: versionId }, include: { booking: true } });
  if (!version) throw new NotFoundError("Quotation");
  const visible = await db.booking.findFirst({ where: { AND: [{ id: version.bookingId }, bookingVisibility(actor)] }, select: { id: true } });
  if (!visible) throw new NotFoundError("Quotation");
  return version;
}

async function requireDraft(actor: Actor, versionId: string) {
  assertPermission(actor, "quotations.create");
  const version = await requireVersion(actor, versionId);
  if (version.status !== "DRAFT") throw new RuleError(`Version ${version.versionNumber} has been sent and can't change. Create a new version instead.`);
  if (version.booking.status === "CANCELLED" || version.booking.status === "COMPLETED") throw new RuleError("This booking is closed.");
  return version;
}

/** Recomputes every line and the version totals from the lines and options. */
async function recalc(tx: Tx, versionId: string) {
  const version = await tx.quotationVersion.findUniqueOrThrow({ where: { id: versionId }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
  const result = computeQuote(
    version.lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, discount: l.discount, taxRatePercent: l.taxRatePercent })),
    { pricesIncludeTax: version.pricesIncludeTax, supplyType: version.supplyType, bookingDiscount: version.bookingDiscount, roundGrandTotal: version.roundGrandTotal },
  );
  for (const [i, line] of version.lines.entries()) {
    const r = result.lines[i];
    await tx.quotationLine.update({
      where: { id: line.id },
      data: { allocatedDiscount: r.allocatedDiscount.toFixed(2), taxableValue: r.taxableValue.toFixed(2), cgst: r.cgst.toFixed(2), sgst: r.sgst.toFixed(2), igst: r.igst.toFixed(2), lineTotal: r.lineTotal.toFixed(2) },
    });
  }
  await tx.quotationVersion.update({
    where: { id: versionId },
    data: {
      subtotal: result.subtotal.toFixed(2),
      discountTotal: result.discountTotal.toFixed(2),
      taxableTotal: result.taxableTotal.toFixed(2),
      cgstTotal: result.cgstTotal.toFixed(2),
      sgstTotal: result.sgstTotal.toFixed(2),
      igstTotal: result.igstTotal.toFixed(2),
      taxTotal: result.taxTotal.toFixed(2),
      roundOff: result.roundOff.toFixed(2),
      grandTotal: result.grandTotal.toFixed(2),
    },
  });
}

/** Supply type from the venue's GST state and the place of supply; null when the venue state isn't set. */
async function derivedSupplyType(placeOfSupply: string | null): Promise<SupplyType | null> {
  const { stateCode } = await getSettings("business");
  if (!stateCode || !placeOfSupply) return null;
  return supplyTypeFor(stateCode, placeOfSupply);
}

export async function listQuotations(actor: Actor, bookingId: string) {
  assertPermission(actor, "bookings.read");
  const visible = await db.booking.findFirst({ where: { AND: [{ id: bookingId }, bookingVisibility(actor)] }, select: { id: true } });
  if (!visible) throw new NotFoundError("Booking");
  return db.quotationVersion.findMany({ where: { bookingId }, orderBy: { versionNumber: "desc" }, include: { lines: { orderBy: { sortOrder: "asc" } } } });
}

/**
 * Opens a new draft version (only one draft at a time), optionally copying
 * the lines of an earlier version exactly as they were priced.
 */
export async function createDraft(actor: Actor, bookingId: string, copyFromVersionId: string | null) {
  assertPermission(actor, "quotations.create");
  const booking = await db.booking.findFirst({ where: { AND: [{ id: bookingId }, bookingVisibility(actor)] }, include: { customer: { select: { stateCode: true } } } });
  if (!booking) throw new NotFoundError("Booking");
  if (booking.status === "CANCELLED" || booking.status === "COMPLETED") throw new RuleError("This booking is closed.");
  const existingDraft = await db.quotationVersion.findFirst({ where: { bookingId, status: "DRAFT" } });
  if (existingDraft) return existingDraft;
  const [tax, policy, business] = await Promise.all([getSettings("tax"), getSettings("bookingPolicy"), getSettings("business")]);
  const source = copyFromVersionId ? await db.quotationVersion.findFirst({ where: { id: copyFromVersionId, bookingId }, include: { lines: true } }) : null;
  const placeOfSupply = source?.placeOfSupplyStateCode || booking.placeOfSupplyStateCode || booking.customer.stateCode || business.stateCode || "";
  const supplyType = source?.supplyType ?? (await derivedSupplyType(placeOfSupply)) ?? "INTRA";
  const documents = await getSettings("documents");
  return db.$transaction(async (tx) => {
    const last = await tx.quotationVersion.aggregate({ where: { bookingId }, _max: { versionNumber: true } });
    const versionNumber = (last._max.versionNumber ?? 0) + 1;
    const version = await tx.quotationVersion.create({
      data: {
        bookingId,
        versionNumber,
        pricesIncludeTax: source?.pricesIncludeTax ?? tax.pricesIncludeTaxByDefault,
        supplyType,
        placeOfSupplyStateCode: placeOfSupply,
        roundGrandTotal: source?.roundGrandTotal ?? tax.roundGrandTotal,
        bookingDiscount: source?.bookingDiscount ?? "0",
        validUntil: dateFromKey(addDays(todayIST(), policy.quotationValidityDays)),
        terms: source?.terms ?? documents.quotationTerms,
        notes: source?.notes ?? null,
        createdById: actor.id,
      },
    });
    if (source?.lines.length) {
      await tx.quotationLine.createMany({
        data: source.lines.map((l) => ({
          versionId: version.id,
          sortOrder: l.sortOrder,
          kind: l.kind,
          subEventId: l.subEventId,
          subEventLabel: l.subEventLabel,
          description: l.description,
          sacCode: l.sacCode,
          unit: l.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          taxRatePercent: l.taxRatePercent,
          taxableValue: l.taxableValue,
          cgst: l.cgst,
          sgst: l.sgst,
          igst: l.igst,
          lineTotal: l.lineTotal,
          taxCategoryId: l.taxCategoryId,
          source: l.source ?? undefined,
        })),
      });
      await recalc(tx, version.id);
    }
    await recordActivity({ entityType: "booking", entityId: bookingId, actorId: actor.id, kind: "QUOTATION", message: `Quotation v${versionNumber} drafted${source ? ` from v${source.versionNumber}` : ""}` }, tx);
    return version;
  });
}

export const draftOptionsSchema = z.object({
  pricesIncludeTax: checkboxBool,
  roundGrandTotal: checkboxBool,
  placeOfSupplyStateCode: z
    .string()
    .trim()
    .refine((v) => isGstStateCode(v), "Choose the place of supply"),
  supplyType: z.enum(["INTRA", "INTER"]).optional(),
  bookingDiscount: moneyString("the discount"),
  validUntil: optionalDateKey,
  terms: optionalText(6000),
  notes: optionalText(4000),
});

export async function updateDraftOptions(actor: Actor, versionId: string, input: z.infer<typeof draftOptionsSchema>) {
  const version = await requireDraft(actor, versionId);
  // When the venue's state is known the supply type follows from it; otherwise staff choose.
  const supplyType = (await derivedSupplyType(input.placeOfSupplyStateCode)) ?? input.supplyType ?? version.supplyType;
  await db.$transaction(async (tx) => {
    await tx.quotationVersion.update({
      where: { id: versionId },
      data: {
        pricesIncludeTax: input.pricesIncludeTax,
        roundGrandTotal: input.roundGrandTotal,
        placeOfSupplyStateCode: input.placeOfSupplyStateCode,
        supplyType,
        bookingDiscount: input.bookingDiscount,
        validUntil: input.validUntil ? dateFromKey(input.validUntil) : null,
        terms: input.terms,
        notes: input.notes,
      },
    });
    await recalc(tx, versionId);
  });
}

export const lineSchema = z.object({
  kind: z.enum(["PACKAGE", "PLATES", "SERVICE", "CUSTOM", "EXTRA_PLATES"]),
  subEventId: optionalText(50),
  description: requiredText("Description", 300),
  unit: requiredText("Unit", 40),
  quantity: quantityString,
  unitPrice: moneyString("the unit price"),
  discount: moneyString("the discount"),
  taxCategoryId: requiredText("Tax category", 50),
  serviceItemId: optionalText(50),
});

async function lineFields(tx: Tx, version: { bookingId: string }, input: z.infer<typeof lineSchema>) {
  const tax = await taxFor(input.taxCategoryId);
  if (!tax) fieldError("taxCategoryId", "This tax category has no rate in force today — add one in Catalog → Taxes");
  let subEventLabel: string | null = null;
  if (input.subEventId) {
    const subEvent = await tx.bookingSubEvent.findFirst({ where: { id: input.subEventId, bookingId: version.bookingId } });
    if (!subEvent) fieldError("subEventId", "Choose one of this booking's functions");
    subEventLabel = `${subEvent.name} · ${formatDateKey(subEvent.date, "d MMM")}`;
  }
  return {
    kind: input.kind,
    subEventId: input.subEventId,
    subEventLabel,
    description: input.description,
    sacCode: tax.sacCode,
    unit: input.unit,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    discount: input.discount,
    taxRatePercent: tax.ratePercent,
    taxCategoryId: tax.taxCategoryId,
    // Placeholders; recalc() fills the real values in the same transaction.
    taxableValue: "0",
    cgst: "0",
    sgst: "0",
    igst: "0",
    lineTotal: "0",
  };
}

export async function addLine(actor: Actor, versionId: string, input: z.infer<typeof lineSchema>) {
  const version = await requireDraft(actor, versionId);
  await db.$transaction(async (tx) => {
    const last = await tx.quotationLine.aggregate({ where: { versionId }, _max: { sortOrder: true } });
    const fields = await lineFields(tx, version, input);
    await tx.quotationLine.create({
      data: { versionId, sortOrder: (last._max.sortOrder ?? 0) + 10, ...fields, source: input.serviceItemId ? { type: "service", id: input.serviceItemId } : undefined },
    });
    await recalc(tx, versionId);
  });
}

export async function updateLine(actor: Actor, lineId: string, input: z.infer<typeof lineSchema>) {
  const line = await db.quotationLine.findUnique({ where: { id: lineId } });
  if (!line) throw new NotFoundError("Line");
  const version = await requireDraft(actor, line.versionId);
  await db.$transaction(async (tx) => {
    const fields = await lineFields(tx, version, input);
    await tx.quotationLine.update({ where: { id: lineId }, data: fields });
    await recalc(tx, line.versionId);
  });
}

export async function removeLine(actor: Actor, lineId: string) {
  const line = await db.quotationLine.findUnique({ where: { id: lineId } });
  if (!line) throw new NotFoundError("Line");
  await requireDraft(actor, line.versionId);
  await db.$transaction(async (tx) => {
    await tx.quotationLine.delete({ where: { id: lineId } });
    await recalc(tx, line.versionId);
  });
}

export async function moveLine(actor: Actor, lineId: string, direction: "up" | "down") {
  const line = await db.quotationLine.findUnique({ where: { id: lineId } });
  if (!line) throw new NotFoundError("Line");
  await requireDraft(actor, line.versionId);
  const lines = await db.quotationLine.findMany({ where: { versionId: line.versionId }, orderBy: { sortOrder: "asc" } });
  const index = lines.findIndex((l) => l.id === lineId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= lines.length) return;
  [lines[index], lines[swapIndex]] = [lines[swapIndex], lines[index]];
  await db.$transaction(async (tx) => {
    for (const [i, l] of lines.entries()) await tx.quotationLine.update({ where: { id: l.id }, data: { sortOrder: (i + 1) * 10 } });
    await recalc(tx, line.versionId);
  });
}

/**
 * Adds plate lines for every function that has a menu (and the booking's
 * package, if it has a CRM price), at today's catalogue prices with the
 * season/date pricing rules applied. Functions already on the draft are skipped.
 */
export async function fillFromBooking(actor: Actor, versionId: string) {
  const version = await requireDraft(actor, versionId);
  const [subEvents, booking, rules, existing] = await Promise.all([
    db.bookingSubEvent.findMany({ where: { bookingId: version.bookingId }, orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }], include: { menuSelection: true } }),
    db.booking.findUniqueOrThrow({ where: { id: version.bookingId }, include: { package: true } }),
    activePricingRules(),
    db.quotationLine.findMany({ where: { versionId }, select: { kind: true, subEventId: true, source: true } }),
  ]);
  const missing: string[] = [];
  let added = 0;
  await db.$transaction(async (tx) => {
    let sortOrder = existing.length * 10;
    const add = async (data: Omit<Prisma.QuotationLineCreateManyInput, "versionId" | "sortOrder" | "taxableValue" | "cgst" | "sgst" | "igst" | "lineTotal">) => {
      sortOrder += 10;
      await tx.quotationLine.create({ data: { ...data, versionId, sortOrder, taxableValue: "0", cgst: "0", sgst: "0", igst: "0", lineTotal: "0" } });
      added += 1;
    };
    const firstDate = subEvents[0] ? dateKey(subEvents[0].date) : todayIST();
    const pkg = booking.package;
    if (pkg && pkg.active && pkg.taxCategoryId && (pkg.crmPrice || pkg.perPlateRate) && !existing.some((l) => l.kind === "PACKAGE")) {
      const tax = await taxFor(pkg.taxCategoryId);
      if (!tax) missing.push(`${t(pkg.name, "en")}: its tax category has no rate in force`);
      else if (pkg.crmPrice) {
        const priced = applyPricingRules(pkg.crmPrice, firstDate, "PACKAGE", rules);
        await add({ kind: "PACKAGE", description: t(pkg.name, "en"), sacCode: tax.sacCode, unit: "package", quantity: "1", unitPrice: priced.price.toFixed(2), discount: "0", taxRatePercent: tax.ratePercent, taxCategoryId: tax.taxCategoryId, source: { type: "package", id: pkg.id, pricingRuleIds: priced.applied.map((r) => r.id) } });
      }
    }
    for (const subEvent of subEvents) {
      const selection = subEvent.menuSelection;
      if (!selection) continue;
      if (existing.some((l) => l.kind === "PLATES" && l.subEventId === subEvent.id)) continue;
      const snap = selection.snapshot as unknown as MenuSnapshot;
      const tax = await taxFor(snap.taxCategoryId);
      if (!tax) {
        missing.push(`${subEvent.name}: the menu's tax category has no rate in force`);
        continue;
      }
      const date = dateKey(subEvent.date);
      const priced = applyPricingRules(snap.perPlateRate, date, "PLATES" satisfies PricingTarget, rules);
      await add({
        kind: "PLATES",
        subEventId: subEvent.id,
        subEventLabel: `${subEvent.name} · ${formatDateKey(date, "d MMM")}`,
        description: `${snap.packageName} (${snap.menuName})`,
        sacCode: tax.sacCode,
        unit: "plate",
        quantity: String(selection.guaranteedPlates),
        unitPrice: priced.price.toFixed(2),
        discount: "0",
        taxRatePercent: tax.ratePercent,
        taxCategoryId: tax.taxCategoryId,
        source: { type: "menu_package", id: selection.menuPackageId, pricingRuleIds: priced.applied.map((r) => r.id) },
      });
    }
    await recalc(tx, versionId);
  });
  return { added, missing };
}

/** Freezes the draft: it becomes SENT (immutable) and the booking moves to "Quotation sent". */
export async function markSent(actor: Actor, versionId: string) {
  const version = await requireDraft(actor, versionId);
  const lines = await db.quotationLine.count({ where: { versionId } });
  if (!lines) throw new RuleError("Add at least one line before sending.");
  if (!isGstStateCode(version.placeOfSupplyStateCode)) throw new RuleError("Choose the place of supply before sending.");
  const subEvents = await db.bookingSubEvent.findMany({
    where: { bookingId: version.bookingId },
    orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
    include: { hall: { select: { name: true } }, slotDefinition: { select: { name: true } }, menuSelection: true },
  });
  const snapshot = {
    functions: subEvents.map((s) => ({
      id: s.id,
      name: s.name,
      date: dateKey(s.date),
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      hall: t(s.hall.name, "en"),
      slot: s.slotDefinition?.name ?? null,
      guests: s.expectedGuests,
      menu: s.menuSelection ? { ...(s.menuSelection.snapshot as object), guaranteedPlates: s.menuSelection.guaranteedPlates } : null,
    })),
  };
  await db.$transaction(async (tx) => {
    await recalc(tx, versionId);
    await tx.quotationVersion.update({ where: { id: versionId }, data: { status: "SENT", sentAt: new Date(), snapshot: snapshot as Prisma.InputJsonValue } });
    await recordActivity({ entityType: "booking", entityId: version.bookingId, actorId: actor.id, kind: "QUOTATION", message: `Quotation v${version.versionNumber} marked as sent` }, tx);
    await recordAudit({ actorId: actor.id, action: "quotation.sent", entityType: "quotation_version", entityId: versionId, summary: { booking: version.booking.reference, version: version.versionNumber } }, tx);
  });
  const status = version.booking.status;
  if ((status === "ENQUIRY_HOLD" || status === "TENTATIVE") && can(actor, "bookings.edit")) {
    try {
      await changeBookingStatus(actor, version.bookingId, { to: "QUOTATION_SENT", reason: `Quotation v${version.versionNumber} sent`, overrideReason: null });
    } catch (error) {
      // The quotation is sent either way; the status can be moved by hand.
      if (!(error instanceof RuleError)) throw error;
    }
  }
}

/** Records the customer's acceptance; any previously accepted version is superseded. */
export async function acceptVersion(actor: Actor, versionId: string) {
  assertPermission(actor, "quotations.accept");
  const version = await requireVersion(actor, versionId);
  if (version.status !== "SENT") throw new RuleError(version.status === "ACCEPTED" ? "This version is already accepted." : "Only a sent quotation can be accepted.");
  if (version.booking.status === "CANCELLED" || version.booking.status === "COMPLETED") throw new RuleError("This booking is closed.");
  await db.$transaction(async (tx) => {
    const previous = version.booking.acceptedQuotationId;
    if (previous) await tx.quotationVersion.update({ where: { id: previous }, data: { status: "SUPERSEDED" } });
    await tx.quotationVersion.update({ where: { id: versionId }, data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: actor.id } });
    await tx.booking.update({ where: { id: version.bookingId }, data: { acceptedQuotationId: versionId } });
    await recordActivity({ entityType: "booking", entityId: version.bookingId, actorId: actor.id, kind: "QUOTATION", message: `Quotation v${version.versionNumber} accepted (₹${version.grandTotal.toFixed(2)})` }, tx);
    await recordAudit({ actorId: actor.id, action: "quotation.accepted", entityType: "quotation_version", entityId: versionId, summary: { booking: version.booking.reference, version: version.versionNumber, grandTotal: version.grandTotal.toFixed(2), supersedes: previous } }, tx);
  });
}

export async function deleteDraft(actor: Actor, versionId: string) {
  const version = await requireDraft(actor, versionId);
  await db.$transaction(async (tx) => {
    await tx.quotationVersion.delete({ where: { id: versionId } });
    await recordActivity({ entityType: "booking", entityId: version.bookingId, actorId: actor.id, kind: "QUOTATION", message: `Draft v${version.versionNumber} discarded` }, tx);
  });
}
