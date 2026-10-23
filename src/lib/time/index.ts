import { TZDate } from "@date-fns/tz";
import { format as formatDate } from "date-fns";

/**
 * Time rules (CLAUDE.md rule 8): store UTC, interpret and display in
 * Asia/Kolkata, and let slots cross midnight. Never compare dates as strings.
 */
export const BUSINESS_TIME_ZONE = "Asia/Kolkata";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseDate(date: string): [number, number, number] {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`Expected YYYY-MM-DD, got "${date}"`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function parseTime(time: string): [number, number] {
  const m = TIME_RE.exec(time);
  if (!m) throw new RangeError(`Expected HH:mm, got "${time}"`);
  return [Number(m[1]), Number(m[2])];
}

/** The UTC instant for a wall-clock date + time in Asia/Kolkata. */
export function istToUtc(date: string, time: string): Date {
  const [y, mo, d] = parseDate(date);
  const [h, mi] = parseTime(time);
  return new Date(new TZDate(y, mo - 1, d, h, mi, BUSINESS_TIME_ZONE).getTime());
}

export type TimeRange = { startsAt: Date; endsAt: Date };

/**
 * Build a slot's range from the event date and slot times. When the end time
 * is not after the start time, the slot ends on the next day (e.g. 18:00–01:00).
 */
export function slotRange(date: string, startTime: string, endTime: string): TimeRange {
  const startsAt = istToUtc(date, startTime);
  let endsAt = istToUtc(date, endTime);
  if (endsAt.getTime() <= startsAt.getTime()) {
    endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000);
  }
  return { startsAt, endsAt };
}

/** Range widened by setup (before) and teardown (after) buffers. */
export function effectiveRange(
  range: TimeRange,
  setupBufferMinutes: number,
  teardownBufferMinutes: number,
): TimeRange {
  return {
    startsAt: new Date(range.startsAt.getTime() - setupBufferMinutes * 60_000),
    endsAt: new Date(range.endsAt.getTime() + teardownBufferMinutes * 60_000),
  };
}

/** Half-open overlap: [a.start, a.end) and [b.start, b.end). */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.startsAt.getTime() < b.endsAt.getTime() && b.startsAt.getTime() < a.endsAt.getTime();
}

function istParts(instant: Date): { year: number; month: number } {
  const z = new TZDate(instant.getTime(), BUSINESS_TIME_ZONE);
  return { year: z.getFullYear(), month: z.getMonth() + 1 };
}

/** Calendar year in Asia/Kolkata (used in SP-L-YYYY / SP-B-YYYY references). */
export function calendarYearIST(instant: Date = new Date()): number {
  return istParts(instant).year;
}

/** Indian financial year label, April–March in Asia/Kolkata: "2026-27". */
export function financialYearLabel(instant: Date = new Date()): string {
  const { year, month } = istParts(instant);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Format an instant in Asia/Kolkata with a date-fns pattern. */
export function formatIST(instant: Date, pattern = "d MMM yyyy, h:mm a"): string {
  return formatDate(new TZDate(instant.getTime(), BUSINESS_TIME_ZONE), pattern);
}
