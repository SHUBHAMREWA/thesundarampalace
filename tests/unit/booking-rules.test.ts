import { describe, expect, it } from "vitest";

import {
  canTransition,
  findConflicts,
  guestCountLockDate,
  hallEffectiveRange,
  isGuestCountLocked,
  isMarriageEvent,
  physicalHallsFor,
  plateDifference,
  reservationStateFor,
  type Occupant,
} from "@/lib/booking/rules";
import { addDays, daysBetween, slotRange, todayIST } from "@/lib/time";
import { isValidGstin } from "@/lib/validation/gst";

const hall = { setupBufferMinutes: 60, teardownBufferMinutes: 90 };

function occupant(over: Partial<Occupant> & Pick<Occupant, "startsAt" | "endsAt">): Occupant {
  return {
    reservationId: over.reservationId ?? "r-other",
    bookingId: over.bookingId ?? "b-other",
    bookingReference: "SP-B-2026-00001",
    subEventName: "Reception",
    hallName: "Sample Hall A",
    physicalHallId: over.physicalHallId ?? "hall-a",
    state: over.state ?? "CONFIRMED",
    waitlistPosition: null,
    ...over,
  };
}

describe("booking state machine", () => {
  it("allows the documented path and blocks shortcuts back", () => {
    expect(canTransition("ENQUIRY_HOLD", "TENTATIVE")).toBe(true);
    expect(canTransition("QUOTATION_SENT", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "CANCELLED")).toBe(true);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransition("COMPLETED", "CONFIRMED")).toBe(true);
    expect(canTransition("COMPLETED", "TENTATIVE")).toBe(true);
    expect(canTransition("IN_PROGRESS", "TENTATIVE")).toBe(true);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(true);
    expect(canTransition("CANCELLED", "COMPLETED")).toBe(false);
    expect(canTransition("CONFIRMED", "TENTATIVE")).toBe(true);
    expect(canTransition("CONFIRMED", "ENQUIRY_HOLD")).toBe(false);
  });

  it("maps booking status to reservation state; holds are never confirmed", () => {
    expect(reservationStateFor("ENQUIRY_HOLD")).toBe("HOLD");
    expect(reservationStateFor("QUOTATION_SENT")).toBe("TENTATIVE");
    expect(reservationStateFor("IN_PROGRESS")).toBe("CONFIRMED");
  });
});

describe("conflicts", () => {
  // Evening slot 18:00–01:00 crosses midnight.
  const evening = slotRange("2026-12-12", "18:00", "01:00");
  const nextMorning = slotRange("2026-12-13", "08:00", "15:00");

  it("midnight-crossing slot ends the next day", () => {
    expect(evening.endsAt.toISOString()).toBe("2026-12-12T19:30:00.000Z");
  });

  it("confirmed vs confirmed on the same hall blocks", () => {
    const candidate = { bookingId: "b-new", physicalHallIds: ["hall-a"], range: hallEffectiveRange(evening, hall), state: "CONFIRMED" as const };
    const other = hallEffectiveRange(slotRange("2026-12-12", "22:00", "23:30"), hall);
    const conflicts = findConflicts(candidate, [occupant(other)]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].blocking).toBe(true);
  });

  it("buffers create a clash between back-to-back events", () => {
    const morning = slotRange("2026-12-12", "08:00", "15:00");
    const afternoon = slotRange("2026-12-12", "15:00", "17:00");
    const without = findConflicts(
      { bookingId: "b-new", physicalHallIds: ["hall-a"], range: afternoon, state: "CONFIRMED" },
      [occupant(morning)],
    );
    expect(without).toHaveLength(0); // half-open ranges: 15:00 end meets 15:00 start
    const withBuffers = findConflicts(
      { bookingId: "b-new", physicalHallIds: ["hall-a"], range: hallEffectiveRange(afternoon, hall), state: "CONFIRMED" },
      [occupant(hallEffectiveRange(morning, hall))],
    );
    expect(withBuffers).toHaveLength(1);
  });

  it("an evening slot past midnight clashes with an early next-morning setup", () => {
    const candidate = { bookingId: "b-new", physicalHallIds: ["hall-a"], range: hallEffectiveRange(nextMorning, { setupBufferMinutes: 7 * 60 + 30, teardownBufferMinutes: 0 }), state: "CONFIRMED" as const };
    expect(findConflicts(candidate, [occupant(evening)])).toHaveLength(1);
  });

  it("holds and tentatives are warnings, not blocks", () => {
    const candidate = { bookingId: "b-new", physicalHallIds: ["hall-a"], range: evening, state: "CONFIRMED" as const };
    const result = findConflicts(candidate, [occupant({ ...evening, state: "HOLD" }), occupant({ ...evening, reservationId: "r2", state: "TENTATIVE" })]);
    expect(result.map((c) => c.blocking)).toEqual([false, false]);
  });

  it("different halls never conflict; composite halls occupy their members", () => {
    const comps = [
      { compositeHallId: "grand", memberHallId: "hall-a" },
      { compositeHallId: "grand", memberHallId: "hall-b" },
    ];
    expect(physicalHallsFor("grand", comps)).toEqual(["hall-a", "hall-b"]);
    expect(physicalHallsFor("hall-a", comps)).toEqual(["hall-a"]);
    const onB = occupant({ ...evening, physicalHallId: "hall-b" });
    expect(findConflicts({ bookingId: "x", physicalHallIds: ["hall-a"], range: evening, state: "CONFIRMED" }, [onB])).toHaveLength(0);
    expect(findConflicts({ bookingId: "x", physicalHallIds: physicalHallsFor("grand", comps), range: evening, state: "CONFIRMED" }, [onB])).toHaveLength(1);
  });

  it("ignores the booking's own reservations and released ones", () => {
    const candidate = { bookingId: "b-same", physicalHallIds: ["hall-a"], range: evening, state: "CONFIRMED" as const };
    expect(findConflicts(candidate, [occupant({ ...evening, bookingId: "b-same" }), occupant({ ...evening, reservationId: "r3", state: "RELEASED" })])).toHaveLength(0);
  });
});

describe("plates and guest counts", () => {
  it("locks guaranteed plates N days before the event", () => {
    expect(guestCountLockDate("2026-12-12", 7)).toBe("2026-12-05");
    expect(isGuestCountLocked("2026-12-04", "2026-12-12", 7)).toBe(false);
    expect(isGuestCountLocked("2026-12-05", "2026-12-12", 7)).toBe(true);
  });

  it("bills extra plates; shortfall is reported separately", () => {
    expect(plateDifference(300, 340)).toEqual({ extra: 40, shortfall: 0 });
    expect(plateDifference(300, 280)).toEqual({ extra: 0, shortfall: 20 });
  });

  it("marriage events show the bride and groom section", () => {
    expect(isMarriageEvent("wedding")).toBe(true);
    expect(isMarriageEvent("corporate")).toBe(false);
  });
});

describe("calendar dates", () => {
  it("does day arithmetic without time-zone drift", () => {
    expect(addDays("2027-03-31", 1)).toBe("2027-04-01");
    expect(daysBetween("2026-10-24", "2027-01-22")).toBe(90);
    // 20:00 UTC on 31 Mar is already 1 Apr in India.
    expect(todayIST(new Date("2027-03-31T20:00:00Z"))).toBe("2027-04-01");
  });
});

describe("GSTIN", () => {
  it("checks format, state code and check character", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin("27aapfu0939f1zv")).toBe(true);
    expect(isValidGstin("27AAPFU0939F1ZX")).toBe(false);
    expect(isValidGstin("99AAPFU0939F1ZV")).toBe(false);
    expect(isValidGstin("27AAPFU0939F1Z")).toBe(false);
  });
});
