import { describe, expect, it } from "vitest";

import {
  calendarYearIST,
  effectiveRange,
  financialYearLabel,
  formatIST,
  istToUtc,
  rangesOverlap,
  slotRange,
} from "@/lib/time";

describe("Asia/Kolkata conversion", () => {
  it("converts IST wall-clock time to UTC", () => {
    expect(istToUtc("2026-12-10", "18:00").toISOString()).toBe("2026-12-10T12:30:00.000Z");
    expect(istToUtc("2026-12-10", "00:15").toISOString()).toBe("2026-12-09T18:45:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(() => istToUtc("10-12-2026", "18:00")).toThrow(RangeError);
    expect(() => istToUtc("2026-12-10", "25:00")).toThrow(RangeError);
  });

  it("formats in IST", () => {
    expect(formatIST(new Date("2026-12-10T12:30:00Z"), "yyyy-MM-dd HH:mm")).toBe("2026-12-10 18:00");
  });
});

describe("slot ranges", () => {
  it("keeps same-day slots on the same day", () => {
    const r = slotRange("2026-12-10", "08:00", "15:00");
    expect(r.startsAt.toISOString()).toBe("2026-12-10T02:30:00.000Z");
    expect(r.endsAt.toISOString()).toBe("2026-12-10T09:30:00.000Z");
  });

  it("moves the end to the next day when a slot crosses midnight", () => {
    const r = slotRange("2026-12-10", "18:00", "01:00");
    expect(r.endsAt.toISOString()).toBe("2026-12-10T19:30:00.000Z"); // 01:00 IST on 11 Dec
    expect(r.endsAt.getTime() - r.startsAt.getTime()).toBe(7 * 60 * 60 * 1000);
  });

  it("detects overlap of a midnight-crossing slot with the next morning's setup", () => {
    const evening = effectiveRange(slotRange("2026-12-10", "18:00", "01:00"), 120, 120);
    const nextMorning = effectiveRange(slotRange("2026-12-11", "08:00", "15:00"), 120, 60);
    // evening teardown until 03:00, morning setup from 06:00 → no overlap
    expect(rangesOverlap(evening, nextMorning)).toBe(false);

    const lateEvening = effectiveRange(slotRange("2026-12-10", "20:00", "05:00"), 0, 120);
    expect(rangesOverlap(lateEvening, nextMorning)).toBe(true);
  });

  it("treats ranges as half-open (back-to-back is not a clash)", () => {
    const a = slotRange("2026-12-10", "08:00", "15:00");
    const b = slotRange("2026-12-10", "15:00", "22:00");
    expect(rangesOverlap(a, b)).toBe(false);
    expect(rangesOverlap(a, effectiveRange(b, 30, 0))).toBe(true);
  });
});

describe("years", () => {
  it("rolls the financial year over on 1 April IST", () => {
    expect(financialYearLabel(istToUtc("2027-03-31", "23:59"))).toBe("2026-27");
    expect(financialYearLabel(istToUtc("2027-04-01", "00:00"))).toBe("2027-28");
    // 31 Mar 19:00 UTC is already 1 Apr 00:30 in IST
    expect(financialYearLabel(new Date("2027-03-31T19:00:00Z"))).toBe("2027-28");
    expect(financialYearLabel(istToUtc("2099-06-01", "12:00"))).toBe("2099-00");
  });

  it("uses the IST calendar year", () => {
    expect(calendarYearIST(new Date("2026-12-31T19:00:00Z"))).toBe(2027);
  });
});
