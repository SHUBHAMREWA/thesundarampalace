import { addDays, isDateKey, todayIST } from "@/lib/time";

/**
 * Date ranges for the Payments and reports page. Pure, so it is unit-tested.
 * Dates are "YYYY-MM-DD" in Asia/Kolkata; the Indian financial year runs
 * 1 April – 31 March.
 */

export const RANGE_PRESETS = [
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-3-months", label: "Last 3 months" },
  { value: "this-fy", label: "This financial year" },
  { value: "last-fy", label: "Last financial year" },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

export type DateRange = { from: string; to: string };

/** Longest range the page will add up at once (keeps the queries small). */
export const MAX_RANGE_DAYS = 3 * 366;

const monthStart = (index: number) => `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
const monthIndex = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7)) - 1;

export function presetRange(preset: RangePreset, today: string = todayIST()): DateRange {
  const m = monthIndex(today);
  const fyStartYear = Number(today.slice(5, 7)) >= 4 ? Number(today.slice(0, 4)) : Number(today.slice(0, 4)) - 1;
  switch (preset) {
    case "last-month":
      return { from: monthStart(m - 1), to: addDays(monthStart(m), -1) };
    case "last-3-months":
      return { from: monthStart(m - 2), to: today };
    case "this-fy":
      return { from: `${fyStartYear}-04-01`, to: today };
    case "last-fy":
      return { from: `${fyStartYear - 1}-04-01`, to: `${fyStartYear}-03-31` };
    default:
      return { from: monthStart(m), to: today };
  }
}

/**
 * Reads ?preset= or ?from=&to= from the URL. Bad or reversed dates fall back
 * to this month; ranges longer than MAX_RANGE_DAYS are shortened from the start.
 */
export function rangeFromParams(params: { preset?: unknown; from?: unknown; to?: unknown }, today: string = todayIST()): DateRange & { preset: RangePreset | null } {
  const from = typeof params.from === "string" && isDateKey(params.from) ? params.from : null;
  const to = typeof params.to === "string" && isDateKey(params.to) ? params.to : null;
  if (from && to && from <= to) {
    const earliest = addDays(to, -MAX_RANGE_DAYS);
    return { from: from < earliest ? earliest : from, to, preset: null };
  }
  const preset = RANGE_PRESETS.find((p) => p.value === params.preset)?.value ?? "this-month";
  return { ...presetRange(preset, today), preset };
}

/** "YYYY-MM" for every month the range touches, oldest first. */
export function monthsIn(range: DateRange): string[] {
  const out: string[] = [];
  for (let i = monthIndex(range.from); i <= monthIndex(range.to); i++) out.push(monthStart(i).slice(0, 7));
  return out;
}
