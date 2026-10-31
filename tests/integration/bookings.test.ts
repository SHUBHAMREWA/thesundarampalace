import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import { ForbiddenError } from "@/server/policies/authorize";
import {
  addSubEvent,
  bookingDetailsSchema,
  calendarEntries,
  cancelBooking,
  cancellationQuote,
  changeBookingStatus,
  checkAvailability,
  createBooking,
  createBookingSchema,
  getBookingDetail,
  listBookings,
  bookingListQuerySchema,
  menuSelectionSchema,
  removeSubEvent,
  setMenuSelection,
  subEventSchema,
  updateBookingDetails,
} from "@/server/services/bookings";
import { checkPublicDateAvailability } from "@/server/services/availability";
import { RuleError } from "@/server/services/errors";
import { NotFoundError } from "@/server/services/leads";
import { acceptVersion, addLine, createDraft, lineSchema, markSent } from "@/server/services/quotations";
import { recordPayment, paymentSchema } from "@/server/services/money";
import { releaseExpiredHolds, SlotConflictError } from "@/server/services/reservations";

import { describeDb } from "./helpers";
import { actorFor, futureDate, makeCustomer, setupPhase3, type Fixture } from "./phase3-fixtures";

let fx: Fixture;
const P = "bk";

const manager = () => actorFor(fx.users.manager, "manager");
const sales = () => actorFor(fx.users.sales, "sales");

function subEvent(over: Record<string, string>) {
  return subEventSchema.parse({ name: "Wedding", eventTypeKey: "wedding", hallId: fx.hallA.id, ...fx.evening, ...over });
}

async function newBooking(status: "ENQUIRY_HOLD" | "TENTATIVE" = "ENQUIRY_HOLD") {
  const customer = await makeCustomer(P);
  return createBooking(sales(), createBookingSchema.parse({ customerId: customer.id, mainEventName: "Sample wedding", mainEventTypeKey: "wedding", initialStatus: status }));
}

/** Booking with one function and an accepted quotation, ready to confirm. */
async function readyToConfirm(date: string, hallId = fx.hallA.id) {
  const booking = await newBooking("TENTATIVE");
  await addSubEvent(sales(), booking.id, subEvent({ date, hallId }));
  const draft = await createDraft(sales(), booking.id, null);
  await addLine(sales(), draft.id, lineSchema.parse({ kind: "SERVICE", description: "Sample hall rental", unit: "event", quantity: "1", unitPrice: "100000", discount: "0", taxCategoryId: fx.taxHall.id }));
  await markSent(sales(), draft.id);
  await acceptVersion(manager(), draft.id);
  return booking;
}

describeDb("bookings, holds and conflicts (Phase 3)", () => {
  beforeAll(async () => {
    fx = await setupPhase3(P);
  });
  afterAll(() => db.$disconnect());

  it("creates a booking with a reference and an enquiry hold that expires", async () => {
    const booking = await newBooking();
    expect(booking.reference).toMatch(/^SP-B-\d{4}-\d{5}$/);
    const { subEvent: s, waitlistPosition } = await addSubEvent(sales(), booking.id, subEvent({ date: futureDate(40) }));
    expect(waitlistPosition).toBeNull();
    const reservation = await db.slotReservation.findUniqueOrThrow({ where: { subEventId: s.id }, include: { occupancies: true } });
    expect(reservation.state).toBe("HOLD");
    expect(reservation.holdExpiresAt!.getTime()).toBeGreaterThan(Date.now() + 71 * 3_600_000);
    expect(reservation.occupancies).toHaveLength(1);
    // The hall is occupied exactly for the function's own times.
    expect(reservation.occupancies[0].effectiveStartsAt.getTime()).toBe(s.startsAt.getTime()); // no setup buffer
    expect(reservation.occupancies[0].effectiveEndsAt.getTime()).toBe(s.endsAt.getTime());
    const fresh = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(fresh.startDate?.toISOString().slice(0, 10)).toBe(futureDate(40));
  });

  it("a second hold on a taken slot joins the waitlist and is promoted when the first expires", async () => {
    const date = futureDate(45);
    const first = await newBooking();
    await addSubEvent(sales(), first.id, subEvent({ date }));
    const second = await newBooking();
    const result = await addSubEvent(sales(), second.id, subEvent({ date }));
    expect(result.waitlistPosition).toBe(1);
    const third = await newBooking();
    expect((await addSubEvent(sales(), third.id, subEvent({ date }))).waitlistPosition).toBe(2);

    const released = await releaseExpiredHolds(new Date(Date.now() + 80 * 3_600_000));
    expect(released).toBeGreaterThanOrEqual(1);
    const firstRes = await db.slotReservation.findFirstOrThrow({ where: { subEvent: { bookingId: first.id } } });
    expect(firstRes.state).toBe("RELEASED");
    const secondRes = await db.slotReservation.findFirstOrThrow({ where: { subEvent: { bookingId: second.id } } });
    expect(secondRes.waitlistPosition).toBeNull();
    expect(secondRes.holdExpiresAt).not.toBeNull();
    const thirdRes = await db.slotReservation.findFirstOrThrow({ where: { subEvent: { bookingId: third.id } } });
    expect(thirdRes.waitlistPosition).toBe(1);
    const notes = await db.notification.findMany({ where: { kind: { in: ["hold.expired", "hold.promoted"] } } });
    expect(notes.map((n) => n.kind)).toEqual(expect.arrayContaining(["hold.expired", "hold.promoted"]));
  });

  it("confirming needs an accepted quotation and snapshots the cancellation policy", async () => {
    const booking = await newBooking("TENTATIVE");
    await addSubEvent(sales(), booking.id, subEvent({ date: futureDate(50), hallId: fx.hallB.id }));
    await expect(changeBookingStatus(manager(), booking.id, { to: "CONFIRMED", reason: null, overrideReason: null })).rejects.toThrow(/accepted/);
    const ready = await readyToConfirm(futureDate(51));
    await changeBookingStatus(manager(), ready.id, { to: "CONFIRMED", reason: null, overrideReason: null });
    const confirmed = await db.booking.findUniqueOrThrow({ where: { id: ready.id } });
    expect(confirmed.status).toBe("CONFIRMED");
    expect((confirmed.cancellationPolicySnapshot as { slabs: unknown[] }).slabs).toHaveLength(3);
    const occ = await db.slotOccupancy.findMany({ where: { reservation: { subEvent: { bookingId: ready.id } } } });
    expect(occ.every((o) => o.state === "CONFIRMED")).toBe(true);
  });

  it("sales can't confirm", async () => {
    const ready = await readyToConfirm(futureDate(52));
    await expect(changeBookingStatus(sales(), ready.id, { to: "CONFIRMED", reason: null, overrideReason: null })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("two simultaneous confirmations of the same hall and time: exactly one succeeds", async () => {
    const date = futureDate(60);
    const a = await readyToConfirm(date);
    const b = await readyToConfirm(date);
    const results = await Promise.allSettled([
      changeBookingStatus(manager(), a.id, { to: "CONFIRMED", reason: null, overrideReason: null }),
      changeBookingStatus(manager(), b.id, { to: "CONFIRMED", reason: null, overrideReason: null }),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBeInstanceOf(RuleError);
    const statuses = await db.booking.findMany({ where: { id: { in: [a.id, b.id] } }, select: { status: true } });
    expect(statuses.filter((s) => s.status === "CONFIRMED")).toHaveLength(1);
  });

  it("a confirmed clash explains itself; an authorised override with a reason is audited", async () => {
    const date = futureDate(62);
    const first = await readyToConfirm(date);
    await changeBookingStatus(manager(), first.id, { to: "CONFIRMED", reason: null, overrideReason: null });
    const second = await readyToConfirm(date);
    const error = await changeBookingStatus(manager(), second.id, { to: "CONFIRMED", reason: null, overrideReason: null }).catch((e) => e);
    expect(error).toBeInstanceOf(SlotConflictError);
    expect(error.message).toContain(first.reference);
    expect(error.message).toContain("Sample Hall A");
    await expect(changeBookingStatus(sales(), second.id, { to: "CONFIRMED", reason: null, overrideReason: "VIP request" })).rejects.toBeInstanceOf(ForbiddenError);
    await changeBookingStatus(manager(), second.id, { to: "CONFIRMED", reason: null, overrideReason: "Owner approved a shared setup" });
    const audit = await db.auditLog.findFirst({ where: { action: "booking.conflict_overridden" }, orderBy: { createdAt: "desc" } });
    expect(audit?.summary).toMatchObject({ reason: "Owner approved a shared setup" });
  });

  it("a combined hall conflicts with its member halls, not with unrelated ones", async () => {
    const date = futureDate(64);
    const onA = await readyToConfirm(date, fx.hallA.id);
    await changeBookingStatus(manager(), onA.id, { to: "CONFIRMED", reason: null, overrideReason: null });
    const preview = await checkAvailability(manager(), null, subEvent({ date, hallId: fx.grand.id }));
    expect(preview.conflicts.some((c) => c.blocking && c.bookingReference === onA.reference)).toBe(true);
    const onB = await checkAvailability(manager(), null, subEvent({ date, hallId: fx.hallB.id }));
    expect(onB.conflicts).toHaveLength(0);
  });

  it("evening functions cross midnight; with no buffers the hall is free from the minute they end", async () => {
    const date = futureDate(66);
    const evening = await readyToConfirm(date, fx.hallB.id);
    await changeBookingStatus(manager(), evening.id, { to: "CONFIRMED", reason: null, overrideReason: null });
    const next = new Date(new Date(`${date}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
    const early = await checkAvailability(manager(), null, subEvent({ date: next, hallId: fx.hallB.id, startTime: "00:30", endTime: "06:00" }));
    expect(early.conflicts.some((c) => c.blocking)).toBe(true); // the evening runs until 01:00
    const after = await checkAvailability(manager(), null, subEvent({ date: next, hallId: fx.hallB.id, startTime: "01:00", endTime: "06:00" }));
    expect(after.conflicts).toHaveLength(0);
    expect(() => subEventSchema.parse({ name: "Same time", eventTypeKey: "wedding", date, hallId: fx.hallA.id, startTime: "10:00", endTime: "10:00" })).toThrow(/can't be the same/);
  });

  it("the public date check shows only Available or Limited per published hall", async () => {
    const date = futureDate(77);
    const booking = await newBooking("TENTATIVE");
    await addSubEvent(sales(), booking.id, subEvent({ date, hallId: fx.hallA.id, startTime: "10:00", endTime: "14:00" }));
    const busy = await checkPublicDateAvailability(date);
    const status = (id: string) => busy.halls.find((h) => h.hallId === id)?.status;
    expect(status(fx.hallA.id)).toBe("LIMITED");
    expect(status(fx.grand.id)).toBe("LIMITED"); // a combined hall needs every member hall free
    expect(status(fx.hallB.id)).toBe("AVAILABLE");
    const json = JSON.stringify(busy);
    expect(json).not.toContain(booking.reference);
    expect(json).not.toContain("10:00");
    expect(json).not.toMatch(/HOLD|TENTATIVE|CONFIRMED|customer/i);
    const nextDay = await checkPublicDateAvailability(futureDate(78));
    expect(nextDay.halls.find((h) => h.hallId === fx.hallA.id)?.status).toBe("AVAILABLE");
  });

  it("menus respect selection rules and minimum plates; plates lock before the event", async () => {
    const booking = await newBooking("TENTATIVE");
    const { subEvent: s } = await addSubEvent(sales(), booking.id, subEvent({ date: futureDate(3), hallId: fx.hallB.id, ...fx.morning }));
    const starters = fx.menu.items.filter((i) => i.course === "starters").map((i) => i.id);
    await expect(setMenuSelection(sales(), s.id, menuSelectionSchema.parse({ menuPackageId: fx.menuPackage.id, itemIds: starters, guaranteedPlates: "300" }))).rejects.toThrow(/at most 2/);
    await expect(setMenuSelection(sales(), s.id, menuSelectionSchema.parse({ menuPackageId: fx.menuPackage.id, itemIds: starters.slice(0, 2), guaranteedPlates: "50" }))).rejects.toThrow(/at least 100/);
    // First selection inside the lock window is allowed (nothing to change yet)…
    await setMenuSelection(sales(), s.id, menuSelectionSchema.parse({ menuPackageId: fx.menuPackage.id, itemIds: starters.slice(0, 2), guaranteedPlates: "300" }));
    // …but changing plates after the lock date needs plates.change_after_lock.
    await expect(setMenuSelection(sales(), s.id, menuSelectionSchema.parse({ menuPackageId: fx.menuPackage.id, itemIds: starters.slice(0, 2), guaranteedPlates: "320" }))).rejects.toBeInstanceOf(ForbiddenError);
    await setMenuSelection(manager(), s.id, menuSelectionSchema.parse({ menuPackageId: fx.menuPackage.id, itemIds: starters.slice(0, 2), guaranteedPlates: "320" }));
    const selection = await db.subEventMenuSelection.findUniqueOrThrow({ where: { subEventId: s.id } });
    expect(selection.guaranteedPlates).toBe(320);
    const snap = selection.snapshot as { items: { course: string }[]; perPlateRate: string; taxRatePercent?: string };
    expect(snap.items.filter((i) => i.course === "starters")).toHaveLength(2);
    expect(snap.items.some((i) => i.course === "desserts")).toBe(true);
    expect(snap.perPlateRate).toBe("850.00");
    expect(snap.taxRatePercent).toBeUndefined(); // GST on plates is decided per booking
    expect(await db.auditLog.count({ where: { action: "plates.changed_after_lock" } })).toBeGreaterThan(0);
  });

  it("cancelling computes the refund from the snapshotted slabs and releases the slots", async () => {
    const date = futureDate(100);
    const booking = await readyToConfirm(date, fx.hallB.id);
    await changeBookingStatus(manager(), booking.id, { to: "CONFIRMED", reason: null, overrideReason: null });
    const accounts = actorFor(fx.users.accounts, "accounts");
    await recordPayment(accounts, booking.id, paymentSchema.parse({ idempotencyKey: crypto.randomUUID(), amount: "40000", occurredOn: new Date().toISOString().slice(0, 10), method: "UPI" }));
    const quote = await cancellationQuote(manager(), booking.id);
    expect(quote.refundAmount.toFixed(2)).toBe("30000.00"); // 75% slab (100 days ahead)
    await expect(cancelBooking(manager(), booking.id, { reason: "Family emergency", agreedRefund: "35000.00", overrideReason: null })).rejects.toThrow();
    await cancelBooking(manager(), booking.id, { reason: "Family emergency", agreedRefund: null, overrideReason: null });
    const cancelled = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(cancelled.status).toBe("CANCELLED");
    expect((cancelled.cancellation as { agreedRefund: string }).agreedRefund).toBe("30000.00");
    const occ = await db.slotOccupancy.findMany({ where: { reservation: { subEvent: { bookingId: booking.id } } } });
    expect(occ.every((o) => o.state === "CANCELLED")).toBe(true);
    // The slot is free again.
    expect((await checkAvailability(manager(), null, subEvent({ date, hallId: fx.hallB.id }))).conflicts).toHaveLength(0);
    // Cancelled by mistake: restore it (a reason is required) and the hall is reserved again.
    await expect(changeBookingStatus(manager(), booking.id, { to: "CONFIRMED", reason: null, overrideReason: null })).rejects.toThrow();
    await changeBookingStatus(manager(), booking.id, { to: "CONFIRMED", reason: "Cancelled by mistake", overrideReason: null });
    const restored = await db.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect(restored.status).toBe("CONFIRMED");
    expect(restored.cancelledAt).toBeNull();
    expect(restored.cancellation).toBeNull();
    expect((await checkAvailability(manager(), null, subEvent({ date, hallId: fx.hallB.id }))).conflicts.length).toBeGreaterThan(0);
  });

  it("operations staff see only bookings with functions assigned to them, and no money", async () => {
    const ops = actorFor(fx.users.operations, "operations");
    const booking = await newBooking("TENTATIVE");
    await expect(getBookingDetail(ops, booking.id)).rejects.toBeInstanceOf(NotFoundError);
    await addSubEvent(sales(), booking.id, subEvent({ date: futureDate(70), hallId: fx.hallB.id, assignedToId: fx.users.operations }));
    const detail = await getBookingDetail(ops, booking.id);
    expect(detail.customer).toBeNull(); // no customers.read
    const list = await listBookings(ops, bookingListQuerySchema.parse({}));
    expect(list.rows.every((r) => r.customer === null)).toBe(true);
    expect(list.rows.map((r) => r.id)).toContain(booking.id);
    const calendar = await calendarEntries(ops, futureDate(69), futureDate(71));
    expect(calendar.every((e) => e.booking.customer === null)).toBe(true);
  });

  it("confirmed bookings can only be changed with bookings.confirm, and removals need a reason", async () => {
    const booking = await readyToConfirm(futureDate(80), fx.hallB.id);
    await changeBookingStatus(manager(), booking.id, { to: "CONFIRMED", reason: null, overrideReason: null });
    await expect(
      updateBookingDetails(sales(), booking.id, bookingDetailsSchema.parse({ mainEventName: "Renamed", mainEventTypeKey: "wedding" })),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const fn = await db.bookingSubEvent.findFirstOrThrow({ where: { bookingId: booking.id } });
    await expect(removeSubEvent(manager(), fn.id, null)).rejects.toThrow();
    await removeSubEvent(manager(), fn.id, "Function moved to another venue");
    expect(await db.bookingSubEvent.count({ where: { bookingId: booking.id } })).toBe(0);
  });
});

describe("sanity", () => {
  it("fixture helpers produce future dates", () => {
    expect(futureDate(1) > new Date().toISOString().slice(0, 10)).toBe(true);
  });
});
