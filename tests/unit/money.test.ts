import { describe, expect, it } from "vitest";

import {
  amountInWordsINR,
  formatINR,
  money,
  percentOf,
  roundMoney,
  sumMoney,
  supplyTypeFor,
  taxFromInclusiveAmount,
  taxOnTaxableValue,
} from "@/lib/money";

describe("money basics", () => {
  it("rejects fractional JS numbers", () => {
    expect(() => money(0.1)).toThrow(TypeError);
    expect(money(100).toString()).toBe("100");
  });

  it("adds without floating point error", () => {
    expect(sumMoney(["0.1", "0.2"]).toFixed(2)).toBe("0.30");
  });

  it("rounds half up to paise", () => {
    expect(roundMoney("2.345").toFixed(2)).toBe("2.35");
    expect(roundMoney("2.344").toFixed(2)).toBe("2.34");
    expect(roundMoney("-2.345").toFixed(2)).toBe("-2.35");
  });

  it("computes a percentage", () => {
    expect(percentOf("125000", "30").toFixed(2)).toBe("37500.00");
  });
});

describe("formatINR", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR("125000")).toBe("₹1,25,000.00");
    expect(formatINR("12345678.9")).toBe("₹1,23,45,678.90");
    expect(formatINR("0")).toBe("₹0.00");
  });
});

describe("amount in words", () => {
  it.each([
    ["0", "Rupees Zero Only"],
    ["1", "Rupees One Only"],
    ["21", "Rupees Twenty-One Only"],
    ["100", "Rupees One Hundred Only"],
    ["125000", "Rupees One Lakh Twenty-Five Thousand Only"],
    ["1000000", "Rupees Ten Lakh Only"],
    ["12345678", "Rupees One Crore Twenty-Three Lakh Forty-Five Thousand Six Hundred Seventy-Eight Only"],
    ["10.50", "Rupees Ten and Fifty Paise Only"],
    ["0.75", "Seventy-Five Paise Only"],
    ["1500000000", "Rupees One Hundred Fifty Crore Only"],
  ])("%s → %s", (amount, words) => {
    expect(amountInWordsINR(amount)).toBe(words);
  });

  it("rejects negative amounts", () => {
    expect(() => amountInWordsINR("-1")).toThrow(RangeError);
  });
});

describe("GST split", () => {
  it("chooses intra-state vs inter-state by state code", () => {
    expect(supplyTypeFor("23", "23")).toBe("INTRA");
    expect(supplyTypeFor("23", "09")).toBe("INTER");
  });

  it("splits CGST + SGST for intra-state supply", () => {
    const t = taxOnTaxableValue("100000", "18", "INTRA");
    expect(t.cgst.toFixed(2)).toBe("9000.00");
    expect(t.sgst.toFixed(2)).toBe("9000.00");
    expect(t.igst.toFixed(2)).toBe("0.00");
    expect(t.lineTotal.toFixed(2)).toBe("118000.00");
  });

  it("charges IGST for inter-state supply", () => {
    const t = taxOnTaxableValue("100000", "18", "INTER");
    expect(t.igst.toFixed(2)).toBe("18000.00");
    expect(t.cgst.toFixed(2)).toBe("0.00");
  });

  it("rounds each component half up", () => {
    // 999.99 × 9% = 89.9991 → 90.00 per component
    const t = taxOnTaxableValue("999.99", "18", "INTRA");
    expect(t.cgst.toFixed(2)).toBe("90.00");
    expect(t.totalTax.toFixed(2)).toBe("180.00");
  });

  it("back-calculates tax-inclusive amounts and keeps the gross total", () => {
    const t = taxFromInclusiveAmount("118000", "18", "INTRA");
    expect(t.taxableValue.toFixed(2)).toBe("100000.00");
    expect(t.lineTotal.toFixed(2)).toBe("118000.00");

    const odd = taxFromInclusiveAmount("1000", "18", "INTRA");
    expect(odd.taxableValue.plus(odd.totalTax).toFixed(2)).toBe("1000.00");
  });
});
