import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { computeQuote, money } from "@/lib/money";
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
import { assertPermission, can, type Actor } from "@/server/policies/authorize";

import { recordActivity } from "./activity";
import { recordAudit } from "./audit";
import { bookingVisibility, changeBookingStatus, type MenuSnapshot } from "./bookings";
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
  // One quotation per booking, edited in place: only versions replaced by a newer one are frozen.
  if (version.status === "SUPERSEDED") throw new RuleError("This is an older quotation and can't change.");
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
  const booking = await db.booking.findFirst({ where: { AND: [{ id: bookingId }, bookingVisibility(actor)] }, });
  if (!booking) throw new NotFoundError("Booking");
  if (booking.status === "CANCELLED" || booking.status === "COMPLETED") throw new RuleError("This booking is closed.");
  const existingDraft = await db.quotationVersion.findFirst({ where: { bookingId, status: "DRAFT" } });
  if (existingDraft) return existingDraft;
  const [totals, policy] = await Promise.all([getSettings("tax"), getSettings("bookingPolicy")]);
  const source = copyFromVersionId ? await db.quotationVersion.findFirst({ where: { id: copyFromVersionId, bookingId }, include: { lines: true } }) : null;
  const documents = await getSettings("documents");
  return db.$transaction(async (tx) => {
    const last = await tx.quotationVersion.aggregate({ where: { bookingId }, _max: { versionNumber: true } });
    const versionNumber = (last._max.versionNumber ?? 0) + 1;
    const version = await tx.quotationVersion.create({
      data: {
        bookingId,
        versionNumber,
        // No GST (owner decision, 26 Oct 2026): the tax columns stay at their neutral values.
        pricesIncludeTax: false,
        supplyType: "INTRA",
        placeOfSupplyStateCode: "",
        roundGrandTotal: source?.roundGrandTotal ?? totals.roundGrandTotal,
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
          sacCode: "",
          unit: l.unit,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          // Lines copied from a version made before GST was removed lose their tax.
          taxRatePercent: "0",
          taxableValue: "0",
          cgst: "0",
          sgst: "0",
          igst: "0",
          lineTotal: "0",
          taxCategoryId: null,
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
  roundGrandTotal: checkboxBool,
  bookingDiscount: moneyString("the discount"),
  validUntil: optionalDateKey,
  terms: optionalText(6000),
  notes: optionalText(4000),
});

export async function updateDraftOptions(actor: Actor, versionId: string, input: z.infer<typeof draftOptionsSchema>) {
  await requireDraft(actor, versionId);
  await db.$transaction(async (tx) => {
    await tx.quotationVersion.update({
      where: { id: versionId },
      data: {
        roundGrandTotal: input.roundGrandTotal,
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
  // PACKAGE stays valid only for lines written before packages were removed.
  kind: z.enum(["PACKAGE", "PLATES", "SERVICE", "CUSTOM", "EXTRA_PLATES"]),
  subEventId: optionalText(50),
  description: requiredText("Description", 300),
  /** Optional; lines typed in by hand usually have none. */
  unit: z.string().trim().max(40).default(""),
  quantity: quantityString,
  unitPrice: moneyString("the unit price"),
  discount: moneyString("the discount"),
});

async function lineFields(tx: Tx, version: { bookingId: string }, input: z.infer<typeof lineSchema>) {
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
    sacCode: "",
    unit: input.unit,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    discount: input.discount,
    taxRatePercent: "0",
    taxCategoryId: null,
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
      data: { versionId, sortOrder: (last._max.sortOrder ?? 0) + 10, ...fields },
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
 * Adds plate lines for every function that has a menu, at today's
 * catalogue prices, without GST.
 * Functions already on the draft are skipped.
 */
export async function fillFromBooking(actor: Actor, versionId: string) {
  const version = await requireDraft(actor, versionId);
  const [subEvents, existing] = await Promise.all([
    db.bookingSubEvent.findMany({ where: { bookingId: version.bookingId }, orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }], include: { menuSelection: true } }),
    db.quotationLine.findMany({ where: { versionId }, select: { kind: true, subEventId: true, source: true } }),
  ]);
  let added = 0;
  await db.$transaction(async (tx) => {
    let sortOrder = existing.length * 10;
    const add = async (data: Omit<Prisma.QuotationLineCreateManyInput, "versionId" | "sortOrder" | "taxableValue" | "cgst" | "sgst" | "igst" | "lineTotal">) => {
      sortOrder += 10;
      await tx.quotationLine.create({ data: { ...data, versionId, sortOrder, taxableValue: "0", cgst: "0", sgst: "0", igst: "0", lineTotal: "0" } });
      added += 1;
    };
    for (const subEvent of subEvents) {
      const selection = subEvent.menuSelection;
      if (!selection) continue;
      if (existing.some((l) => l.kind === "PLATES" && l.subEventId === subEvent.id)) continue;
      const snap = selection.snapshot as unknown as MenuSnapshot;
      const date = dateKey(subEvent.date);
      await add({
        kind: "PLATES",
        subEventId: subEvent.id,
        subEventLabel: `${subEvent.name} · ${formatDateKey(date, "d MMM")}`,
        description: `${snap.packageName} (${snap.menuName})`,
        sacCode: "",
        unit: "plate",
        quantity: String(selection.guaranteedPlates),
        unitPrice: money(snap.perPlateRate).toFixed(2),
        discount: "0",
        taxRatePercent: "0",
        source: { type: "menu_package", id: selection.menuPackageId },
      });
    }
    await recalc(tx, versionId);
  });
  return { added };
}

/** Freezes the draft: it becomes SENT (immutable) and the booking moves to "Quotation sent". */
export async function markSent(actor: Actor, versionId: string) {
  const version = await requireDraft(actor, versionId);
  const lines = await db.quotationLine.count({ where: { versionId } });
  if (!lines) throw new RuleError("Add at least one line before sending.");
  const subEvents = await db.bookingSubEvent.findMany({
    where: { bookingId: version.bookingId },
    orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
    include: { hall: { select: { name: true } }, menuSelection: true },
  });
  const snapshot = {
    functions: subEvents.map((s) => ({
      id: s.id,
      name: s.name,
      date: dateKey(s.date),
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      hall: t(s.hall.name, "en"),
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
