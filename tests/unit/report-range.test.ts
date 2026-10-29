import { describe, expect, it } from "vitest";

import { monthsIn, presetRange, rangeFromParams } from "@/lib/reports/range";

describe("report date ranges", () => {
  it("builds month and financial-year presets", () => {
    expect(presetRange("this-month", "2026-10-27")).toEqual({ from: "2026-10-01", to: "2026-10-27" });
    expect(presetRange("last-month", "2026-03-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(presetRange("last-month", "2026-01-10")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(presetRange("last-3-months", "2026-02-10")).toEqual({ from: "2025-12-01", to: "2026-02-10" });
    // The Indian financial year starts on 1 April.
    expect(presetRange("this-fy", "2026-10-27")).toEqual({ from: "2026-04-01", to: "2026-10-27" });
    expect(presetRange("this-fy", "2027-02-01")).toEqual({ from: "2026-04-01", to: "2027-02-01" });
    expect(presetRange("last-fy", "2026-10-27")).toEqual({ from: "2025-04-01", to: "2026-03-31" });
  });

  it("reads custom dates and falls back on bad input", () => {
    expect(rangeFromParams({ from: "2026-01-05", to: "2026-02-20" }, "2026-10-27")).toEqual({ from: "2026-01-05", to: "2026-02-20", preset: null });
    expect(rangeFromParams({ from: "2026-03-01", to: "2026-01-01" }, "2026-10-27")).toEqual({ from: "2026-10-01", to: "2026-10-27", preset: "this-month" });
    expect(rangeFromParams({ preset: "last-fy" }, "2026-10-27").from).toBe("2025-04-01");
    expect(rangeFromParams({ from: "2010-01-01", to: "2026-10-27" }, "2026-10-27").from > "2023-01-01").toBe(true);
  });

  it("lists every month a range touches", () => {
    expect(monthsIn({ from: "2025-11-20", to: "2026-02-03" })).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsIn({ from: "2026-10-01", to: "2026-10-27" })).toEqual(["2026-10"]);
  });
});
