import { afterAll, beforeAll, expect, it } from "vitest";

import { db } from "@/lib/db";
import { diffQuotationLines } from "@/lib/booking/quote-diff";
import { DEFAULT_SETTINGS } from "@/lib/settings/schemas";
import { ForbiddenError } from "@/server/policies/authorize";
import {
  addSubEvent,
  changeBookingStatus,
  createBooking,
  createBookingSchema,
  menuSelectionSchema,
  recordActualPlates,
  setMenuSelection,
  subEventSchema,
} from "@/server/services/bookings";
import { isExclusionViolation, isImmutableRowError, RuleError } from "@/server/services/errors";
import {
  adjustmentSchema,
  billExtraPlates,
  creditNoteSchema,
  depositSchema,
  instalmentSchema,
  invoiceSchema,
  issueCreditNote,
  issueInvoice,
  moneySummary,
  paymentSchema,
  recordAdjustment,
  recordDepositEntry,
  recordPayment,
  recordRefund,
  refundSchema,
  saveInstalment,
} from "@/server/services/money";
import { nextGstDocumentNumber } from "@/server/services/numbering";
import {
  acceptVersion,
  addLine,
  createDraft,
  draftOptionsSchema,
  fillFromBooking,
  lineSchema,
  markSent,
  updateDraftOptions,
  updateLine,
} from "@/server/services/quotations";
import { saveSettings } from "@/server/services/settings";

import { describeDb } from "./helpers";
import { actorFor, futureDate, makeCustomer, setBusinessForInvoices, setupPhase3, type Fixture } from "./phase3-fixtures";

let fx: Fixture;
const P = "mn";
const today = () => new Date().toISOString().slice(0, 10);
const key = () => crypto.randomUUID();
// Distinct dates so confirmed sample bookings never clash with each other.
let nextDay = 0;

const manager = () => actorFor(fx.users.manager, "manager");
const sales = () => actorFor(fx.users.sales, "sales");
const accounts = () => actorFor(fx.users.accounts, "accounts");

async function confirmedBooking(opts: { date?: string; hallId?: string; amount?: string; inclusive?: boolean } = {}) {
  const customer = await makeCustomer(P);
  const booking = await createBooking(sales(), createBookingSchema.parse({ customerId: customer.id, mainEventName: "Sample wedding", mainEventTypeKey: "wedding", initialStatus: "TENTATIVE" }));
  await addSubEvent(sales(), booking.id, subEventSchema.parse({ name: "Wedding", eventTypeKey: "wedding", date: opts.date ?? futureDate(90 + 2 * nextDay++), hallId: opts.hallId ?? fx.hallA.id, slotDefinitionId: fx.evening.id }));
  const draft = await createDraft(sales(), booking.id, null);
  if (opts.inclusive) await updateDraftOptions(sales(), draft.id, draftOptionsSchema.parse({ pricesIncludeTax: "on", placeOfSupplyStateCode: "09", bookingDiscount: "0" }));
  await addLine(sales(), draft.id, lineSchema.parse({ kind: "SERVICE", description: "Sample hall rental", unit: "event", quantity: "1", unitPrice: opts.amount ?? "100000", discount: "0", taxCategoryId: fx.taxHall.id }));
  await markSent(sales(), draft.id);
  await acceptVersion(manager(), draft.id);
  await changeBookingStatus(manager(), booking.id, { to: "CONFIRMED", reason: null, overrideReason: null, ...{} });
  return db.booking.findUniqueOrThrow({ where: { id: booking.id } });
}

describeDb("quotations, ledger, invoices and credit notes (Phase 3)", () => {
  beforeAll(async () => {
    fx = await setupPhase3(P);
  });
  afterAll(() => db.$disconnect());

  it("drafts compute GST server-side; sent versions are immutable; edits create a new version", async () => {
    const customer = await makeCustomer(P);
    const booking = await createBooking(sales(), createBookingSchema.parse({ customerId: customer.id, mainEventName: "Sample reception", mainEventTypeKey: "reception", initialStatus: "TENTATIVE" }));
    const draft = await createDraft(sales(), booking.id, null);
    expect(draft.versionNumber).toBe(1);
    await addLine(sales(), draft.id, lineSchema.parse({ kind: "PLATES", description: "Sample plate", unit: "plate", quantity: "300", unitPrice: "850", discount: "0", taxCategoryId: fx.taxFood.id }));
    await addLine(sales(), draft.id, lineSchema.parse({ kind: "SERVICE", description: "Sample hall rental", unit: "event", quantity: "1", unitPrice: "150000", discount: "0", taxCategoryId: fx.taxHall.id }));
    let v1 = await db.quotationVersion.findUniqueOrThrow({ where: { id: draft.id }, include: { lines: true } });
    expect(v1.grandTotal.toFixed(2)).toBe("444750.00");
    expect(v1.supplyType).toBe("INTRA"); // customer state 09 = venue state (set below) or default
    await updateDraftOptions(sales(), draft.id, draftOptionsSchema.parse({ placeOfSupplyStateCode: "09", bookingDiscount: "4000", supplyType: "INTRA" }));
    v1 = await db.quotationVersion.findUniqueOrThrow({ where: { id: draft.id }, include: { lines: true } });
    expect(v1.discountTotal.toFixed(2)).toBe("4000.00");
    await markSent(sales(), draft.id);
    const after = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(after.status).toBe("QUOTATION_SENT");

    // The database refuses edits to a sent version.
    const line = v1.lines[0];
    const err = await db.quotationLine.update({ where: { id: line.id }, data: { unitPrice: "1" } }).catch((e) => e);
    expect(isImmutableRowError(err)).toBe(true);
    const err2 = await db.quotationVersion.update({ where: { id: draft.id }, data: { grandTotal: "1" } }).catch((e) => e);
    expect(isImmutableRowError(err2)).toBe(true);
    await expect(updateLine(sales(), line.id, lineSchema.parse({ kind: "PLATES", description: "x", unit: "plate", quantity: "1", unitPrice: "1", discount: "0", taxCategoryId: fx.taxFood.id }))).rejects.toBeInstanceOf(RuleError);

    // v2 copies v1's lines exactly; a change shows up in the diff.
    const v2 = await createDraft(sales(), booking.id, draft.id);
    expect(v2.versionNumber).toBe(2);
    const v2Lines = await db.quotationLine.findMany({ where: { versionId: v2.id }, orderBy: { sortOrder: "asc" } });
    await updateLine(sales(), v2Lines[0].id, lineSchema.parse({ kind: "PLATES", description: "Sample plate", unit: "plate", quantity: "350", unitPrice: "850", discount: "0", taxCategoryId: fx.taxFood.id }));
    const [a, b] = await Promise.all([
      db.quotationLine.findMany({ where: { versionId: draft.id }, orderBy: { sortOrder: "asc" } }),
      db.quotationLine.findMany({ where: { versionId: v2.id }, orderBy: { sortOrder: "asc" } }),
    ]);
    const asDiff = (l: (typeof a)[number]) => ({ kind: l.kind, subEventLabel: l.subEventLabel, description: l.description, quantity: l.quantity.toString(), unitPrice: l.unitPrice.toString(), lineTotal: l.lineTotal.toString() });
    const changes = diffQuotationLines(a.map(asDiff), b.map(asDiff));
    // The plate line changed; the hall line's total moves too, because the
    // quotation-level discount is re-spread pro rata.
    expect(changes).toHaveLength(2);
    expect(changes[0]).toMatchObject({ type: "changed", fields: ["quantity", "lineTotal"] });
    expect(changes[1]).toMatchObject({ type: "changed", fields: ["lineTotal"] });

    // Accepting needs quotations.accept; a later acceptance supersedes the earlier one.
    await expect(acceptVersion(sales(), draft.id)).rejects.toBeInstanceOf(ForbiddenError);
    await acceptVersion(manager(), draft.id);
    await markSent(sales(), v2.id);
    await acceptVersion(manager(), v2.id);
    const versions = await db.quotationVersion.findMany({ where: { bookingId: booking.id }, orderBy: { versionNumber: "asc" } });
    expect(versions.map((v) => v.status)).toEqual(["SUPERSEDED", "ACCEPTED"]);
    expect((await db.booking.findUniqueOrThrow({ where: { id: booking.id } })).acceptedQuotationId).toBe(v2.id);
  });

  it("fills plate lines from menus with pricing rules applied (new quotations only)", async () => {
    const customer = await makeCustomer(P);
    const booking = await createBooking(sales(), createBookingSchema.parse({ customerId: customer.id, mainEventName: "Sample sangeet", mainEventTypeKey: "sangeet", initialStatus: "TENTATIVE" }));
    const date = futureDate(120);
    const { subEvent } = await addSubEvent(sales(), booking.id, subEventSchema.parse({ name: "Sangeet", eventTypeKey: "sangeet", date, hallId: fx.hallB.id, slotDefinitionId: fx.evening.id }));
    const starters = fx.menu.items.filter((i) => i.course === "starters").map((i) => i.id).slice(0, 2);
    await setMenuSelection(sales(), subEvent.id, menuSelectionSchema.parse({ menuPackageId: fx.menuPackage.id, itemIds: starters, guaranteedPlates: "250" }));
    const rule = await db.pricingRule.create({ data: { name: "Sample uplift", kind: "DATE", dates: [date], adjustmentType: "PERCENT", adjustmentValue: "10", appliesTo: "PLATES" } });
    const draft = await createDraft(sales(), booking.id, null);
    const result = await fillFromBooking(sales(), draft.id);
    expect(result.added).toBe(1);
    const line = await db.quotationLine.findFirstOrThrow({ where: { versionId: draft.id } });
    expect(line.quantity.toString()).toBe("250");
    expect(line.unitPrice.toFixed(2)).toBe("935.00");
    expect(line.sacCode).toBe("996334");
    expect((await fillFromBooking(sales(), draft.id)).added).toBe(0);
    await db.pricingRule.update({ where: { id: rule.id }, data: { active: false } });
  });

  it("payments are idempotent, refunds are capped, mistakes are reversed (never edited)", async () => {
    const booking = await confirmedBooking({ amount: "100000" });
    await expect(recordPayment(sales(), booking.id, paymentSchema.parse({ idempotencyKey: key(), amount: "1000", occurredOn: today(), method: "CASH" }))).rejects.toBeInstanceOf(ForbiddenError);
    const k = key();
    const input = paymentSchema.parse({ idempotencyKey: k, amount: "50,000", occurredOn: today(), method: "UPI", transactionRef: "UPI-REF-TEST" });
    const first = await recordPayment(accounts(), booking.id, input);
    const again = await recordPayment(accounts(), booking.id, input);
    expect(again).toEqual({ duplicate: true });
    expect(await db.ledgerEntry.count({ where: { bookingId: booking.id } })).toBe(1);
    expect("receiptNumber" in first && first.receiptNumber).toMatch(/^SP-R-\d{4}-\d{2}-\d{5}$/);

    await expect(recordPayment(accounts(), booking.id, paymentSchema.parse({ idempotencyKey: key(), amount: "1", occurredOn: futureDate(5), method: "CASH" }))).rejects.toThrow();
    await expect(recordRefund(accounts(), booking.id, refundSchema.parse({ idempotencyKey: key(), amount: "60000", occurredOn: today(), method: "UPI", reason: "Too much" }))).rejects.toThrow(/can't exceed/);

    const entryId = (first as { id: string }).id;
    const editAttempt = await db.ledgerEntry.update({ where: { id: entryId }, data: { amount: "1" } }).catch((e) => e);
    expect(isImmutableRowError(editAttempt)).toBe(true);
    const deleteAttempt = await db.ledgerEntry.delete({ where: { id: entryId } }).catch((e) => e);
    expect(isImmutableRowError(deleteAttempt)).toBe(true);

    await recordAdjustment(accounts(), booking.id, adjustmentSchema.parse({ idempotencyKey: key(), amount: "1", direction: "IN", occurredOn: today(), reason: "Entered against the wrong booking", reversesEntryId: entryId }));
    await expect(recordAdjustment(accounts(), booking.id, adjustmentSchema.parse({ idempotencyKey: key(), amount: "1", direction: "IN", occurredOn: today(), reason: "Again", reversesEntryId: entryId }))).rejects.toThrow(/already been reversed/);
    const summary = await moneySummary(accounts(), booking.id);
    expect(summary.balance.netReceived.toFixed(2)).toBe("0.00");
    expect(summary.balance.outstanding.toFixed(2)).toBe("118000.00");
    expect(summary.ledger.find((e) => e.id === entryId)?.reversed).toBe(true);
  });

  it("schedules instalments and reports their paid status from the ledger", async () => {
    const booking = await confirmedBooking({ amount: "100000" });
    await saveInstalment(accounts(), booking.id, null, instalmentSchema.parse({ label: "Advance", dueOn: today(), amount: "50000" }));
    await saveInstalment(accounts(), booking.id, null, instalmentSchema.parse({ label: "Balance", dueOn: futureDate(30), amount: "68000" }));
    await recordPayment(accounts(), booking.id, paymentSchema.parse({ idempotencyKey: key(), amount: "60000", occurredOn: today(), method: "BANK_TRANSFER" }));
    const summary = await moneySummary(accounts(), booking.id);
    expect(summary.schedule.map((s) => [s.label, s.status, s.paid.toFixed(2)])).toEqual([
      ["Advance", "PAID", "50000.00"],
      ["Balance", "PARTLY_PAID", "10000.00"],
    ]);
    expect(summary.balance.status).toBe("PARTLY_PAID");
  });

  it("the security deposit is a separate ledger; deductions can't exceed what is held", async () => {
    const booking = await confirmedBooking();
    const base = { occurredOn: today() };
    await recordDepositEntry(accounts(), booking.id, depositSchema.parse({ ...base, idempotencyKey: key(), type: "RECEIVED", amount: "25000", method: "CASH" }));
    await expect(recordDepositEntry(accounts(), booking.id, depositSchema.parse({ ...base, idempotencyKey: key(), type: "DEDUCTION", amount: "1000" }))).rejects.toThrow();
    await recordDepositEntry(accounts(), booking.id, depositSchema.parse({ ...base, idempotencyKey: key(), type: "DEDUCTION", amount: "4000", reason: "Broken chairs" }));
    await expect(recordDepositEntry(accounts(), booking.id, depositSchema.parse({ ...base, idempotencyKey: key(), type: "REFUNDED", amount: "22000", method: "UPI" }))).rejects.toThrow(/held/);
    await recordDepositEntry(accounts(), booking.id, depositSchema.parse({ ...base, idempotencyKey: key(), type: "REFUNDED", amount: "21000", method: "UPI" }));
    const summary = await moneySummary(accounts(), booking.id);
    expect(summary.balance.deposit.held.toFixed(2)).toBe("0.00");
    expect(summary.balance.netReceived.toFixed(2)).toBe("0.00"); // deposit is not revenue
  });

  it("issues GST invoices only with business details, numbered per financial year without gaps", async () => {
    const booking = await confirmedBooking({ amount: "100000" });
    await expect(issueInvoice(accounts(), booking.id, invoiceSchema.parse({ idempotencyKey: key(), source: "QUOTATION", issuedOn: today() }))).rejects.toThrow(/Settings/);
    await setBusinessForInvoices(fx.users.super_admin);
    const invoice = await issueInvoice(accounts(), booking.id, invoiceSchema.parse({ idempotencyKey: key(), source: "QUOTATION", issuedOn: today() }));
    if ("duplicate" in invoice) throw new Error("unexpected duplicate");
    expect(invoice.number).toMatch(/^SP\/\d{2}-\d{2}\/\d{4}$/);
    expect(invoice.number.length).toBeLessThanOrEqual(16);
    expect(invoice.grandTotal.toFixed(2)).toBe("118000.00");
    expect(invoice.cgstTotal.toFixed(2)).toBe("9000.00");
    expect(invoice.amountInWords).toBe("Rupees One Lakh Eighteen Thousand Only");
    await expect(issueInvoice(accounts(), booking.id, invoiceSchema.parse({ idempotencyKey: key(), source: "QUOTATION", issuedOn: today() }))).rejects.toThrow(/already invoiced/);

    // Immutable after issue, except its status.
    const edit = await db.invoice.update({ where: { id: invoice.id }, data: { grandTotal: "1" } }).catch((e) => e);
    expect(isImmutableRowError(edit)).toBe(true);
    const del = await db.invoice.delete({ where: { id: invoice.id } }).catch((e) => e);
    expect(isImmutableRowError(del)).toBe(true);
  });

  it("allocates concurrent invoice numbers without gaps or duplicates, and restarts on 1 April", async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => db.$transaction((tx) => nextGstDocumentNumber(tx, "invoice", "TST", new Date("2031-03-31T00:00:00Z")))),
    );
    const sequences = results.map((r) => r.sequence).sort((a, b) => a - b);
    expect(sequences).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(results[0].number).toMatch(/^TST\/30-31\/\d{4}$/);
    const april = await db.$transaction((tx) => nextGstDocumentNumber(tx, "invoice", "TST", new Date("2031-04-01T00:00:00Z")));
    expect(april).toMatchObject({ financialYear: "2031-32", sequence: 1, number: "TST/31-32/0001" });
  });

  it("credit notes reduce an invoice line by line and never exceed it", async () => {
    await setBusinessForInvoices(fx.users.super_admin);
    const booking = await confirmedBooking({ amount: "100000", inclusive: true });
    const invoice = await issueInvoice(accounts(), booking.id, invoiceSchema.parse({ idempotencyKey: key(), source: "QUOTATION", issuedOn: today() }));
    if ("duplicate" in invoice) throw new Error("unexpected duplicate");
    expect(invoice.grandTotal.toFixed(2)).toBe("100000.00"); // tax-inclusive price
    const line = await db.invoiceLine.findFirstOrThrow({ where: { invoiceId: invoice.id } });
    await expect(issueCreditNote(sales(), invoice.id, creditNoteSchema.parse({ idempotencyKey: key(), issuedOn: today(), reason: "x", mode: "all" }))).rejects.toBeInstanceOf(ForbiddenError);
    const partial = await issueCreditNote(accounts(), invoice.id, creditNoteSchema.parse({ idempotencyKey: key(), issuedOn: today(), reason: "Fewer guests", mode: "lines", lines: { [line.id]: "10000" } }));
    if ("duplicate" in partial) throw new Error("unexpected duplicate");
    expect(partial.taxableTotal.toFixed(2)).toBe("10000.00");
    expect(partial.grandTotal.toFixed(2)).toBe("11800.00");
    expect(partial.number).toMatch(/^SPCN\/\d{2}-\d{2}\/\d{4}$/);
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("PARTIALLY_CREDITED");
    await expect(issueCreditNote(accounts(), invoice.id, creditNoteSchema.parse({ idempotencyKey: key(), issuedOn: today(), reason: "Too much", mode: "lines", lines: { [line.id]: "90000" } }))).rejects.toThrow(/At most/);
    const rest = await issueCreditNote(accounts(), invoice.id, creditNoteSchema.parse({ idempotencyKey: key(), issuedOn: today(), reason: "Cancelled", mode: "all" }));
    if ("duplicate" in rest) throw new Error("unexpected duplicate");
    expect(partial.grandTotal.plus(rest.grandTotal).toFixed(2)).toBe("100000.00");
    expect((await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status).toBe("FULLY_CREDITED");
  });

  it("bills extra plates at the agreed rate as a post-event charge, once", async () => {
    await setBusinessForInvoices(fx.users.super_admin);
    const customer = await makeCustomer(P);
    const booking = await createBooking(sales(), createBookingSchema.parse({ customerId: customer.id, mainEventName: "Sample wedding", mainEventTypeKey: "wedding", initialStatus: "TENTATIVE" }));
    // A function that has already started (yesterday) so plates can be recorded.
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { subEvent } = await addSubEvent(sales(), booking.id, subEventSchema.parse({ name: "Wedding", eventTypeKey: "wedding", date: yesterday, hallId: fx.hallA.id, slotDefinitionId: fx.morning.id }));
    const starters = fx.menu.items.filter((i) => i.course === "starters").map((i) => i.id).slice(0, 2);
    await setMenuSelection(manager(), subEvent.id, menuSelectionSchema.parse({ menuPackageId: fx.menuPackage.id, itemIds: starters, guaranteedPlates: "200" }));
    const draft = await createDraft(sales(), booking.id, null);
    await fillFromBooking(sales(), draft.id);
    await markSent(sales(), draft.id);
    await acceptVersion(manager(), draft.id);
    await changeBookingStatus(manager(), booking.id, { to: "CONFIRMED", reason: null, overrideReason: null });
    await recordActualPlates(manager(), subEvent.id, 230);
    const k = key();
    await billExtraPlates(accounts(), subEvent.id, k);
    await expect(billExtraPlates(accounts(), subEvent.id, key())).rejects.toThrow(/already billed/);
    const charge = await db.postEventCharge.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect(charge.quantity.toString()).toBe("30");
    expect(charge.unitPrice.toFixed(2)).toBe("850.00");
    expect(charge.lineTotal.toFixed(2)).toBe("26775.00"); // 25500 + 5%
    const invoice = await issueInvoice(accounts(), booking.id, invoiceSchema.parse({ idempotencyKey: key(), source: "CHARGES", issuedOn: today() }));
    if ("duplicate" in invoice) throw new Error("unexpected duplicate");
    expect(invoice.grandTotal.toFixed(2)).toBe("26775.00");
    await expect(issueInvoice(accounts(), booking.id, invoiceSchema.parse({ idempotencyKey: key(), source: "CHARGES", issuedOn: today() }))).rejects.toThrow(/no post-event charges/);
    const summary = await moneySummary(accounts(), booking.id);
    expect(summary.postEventTotal.toFixed(2)).toBe("26775.00");
  });

  it("the database itself refuses overlapping confirmed occupancies", async () => {
    const date = futureDate(300);
    const a = await confirmedBooking({ date, hallId: fx.hallB.id });
    const occ = await db.slotOccupancy.findFirstOrThrow({ where: { reservation: { subEvent: { bookingId: a.id } } } });
    const other = await db.slotReservation.findFirstOrThrow({ where: { NOT: { id: occ.reservationId } } });
    const error = await db.slotOccupancy
      .create({ data: { reservationId: other.id, physicalHallId: occ.physicalHallId, effectiveStartsAt: occ.effectiveStartsAt, effectiveEndsAt: occ.effectiveEndsAt, state: "CONFIRMED" } })
      .catch((e) => e);
    expect(isExclusionViolation(error)).toBe(true);
  });

  it("restores default settings for later tests", async () => {
    await saveSettings("business", DEFAULT_SETTINGS.business, fx.users.super_admin);
    expect(true).toBe(true);
  });
});
