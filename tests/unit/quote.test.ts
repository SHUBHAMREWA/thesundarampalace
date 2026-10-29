import { describe, expect, it } from "vitest";

import {
  allocateProRata,
  allocateToInstalments,
  bookingBalance,
  cancellationRefund,
  computeQuote,
  depositTotals,
  ledgerTotals,
  QuoteError,
  sumMoney,
} from "@/lib/money";

const fixed = (values: { toFixed(n: number): string }[]) => values.map((v) => v.toFixed(2));

describe("pro-rata allocation", () => {
  it("splits exactly, leftover paise to the largest lines", () => {
    const parts = allocateProRata("100.00", ["1", "1", "1"]);
    expect(fixed(parts)).toEqual(["33.34", "33.33", "33.33"]);
    expect(sumMoney(parts).toFixed(2)).toBe("100.00");
  });

  it("weights by amount", () => {
    expect(fixed(allocateProRata("10.00", ["300", "100"]))).toEqual(["7.50", "2.50"]);
  });

  it("returns zeros when there is nothing to split", () => {
    expect(fixed(allocateProRata("0", ["10", "20"]))).toEqual(["0.00", "0.00"]);
  });
});

describe("quotation totals", () => {
  it("tax-exclusive, intra-state: CGST + SGST on each line", () => {
    const q = computeQuote(
      [
        { quantity: "300", unitPrice: "850", taxRatePercent: "5" }, // plates
        { quantity: "1", unitPrice: "150000", taxRatePercent: "18" }, // hall
      ],
      { pricesIncludeTax: false, supplyType: "INTRA" },
    );
    expect(q.subtotal.toFixed(2)).toBe("405000.00");
    expect(q.lines[0].cgst.toFixed(2)).toBe("6375.00");
    expect(q.lines[0].sgst.toFixed(2)).toBe("6375.00");
    expect(q.lines[1].cgst.toFixed(2)).toBe("13500.00");
    expect(q.taxTotal.toFixed(2)).toBe("39750.00");
    expect(q.grandTotal.toFixed(2)).toBe("444750.00");
    expect(q.igstTotal.toFixed(2)).toBe("0.00");
  });

  it("inter-state uses IGST only", () => {
    const q = computeQuote([{ quantity: "1", unitPrice: "1000", taxRatePercent: "18" }], {
      pricesIncludeTax: false,
      supplyType: "INTER",
    });
    expect(q.igstTotal.toFixed(2)).toBe("180.00");
    expect(q.cgstTotal.toFixed(2)).toBe("0.00");
  });

  it("discounts reduce the taxable value before tax", () => {
    const q = computeQuote([{ quantity: "1", unitPrice: "10000", discount: "1000", taxRatePercent: "18" }], {
      pricesIncludeTax: false,
      supplyType: "INTRA",
    });
    expect(q.lines[0].taxableValue.toFixed(2)).toBe("9000.00");
    expect(q.taxTotal.toFixed(2)).toBe("1620.00");
    expect(q.discountTotal.toFixed(2)).toBe("1000.00");
    expect(q.grandTotal.toFixed(2)).toBe("10620.00");
  });

  it("spreads a quotation-level discount pro rata", () => {
    const q = computeQuote(
      [
        { quantity: "1", unitPrice: "30000", taxRatePercent: "18" },
        { quantity: "1", unitPrice: "10000", taxRatePercent: "5" },
      ],
      { pricesIncludeTax: false, supplyType: "INTRA", bookingDiscount: "4000" },
    );
    expect(fixed(q.lines.map((l) => l.allocatedDiscount))).toEqual(["3000.00", "1000.00"]);
    expect(q.taxableTotal.toFixed(2)).toBe("36000.00");
    // 27000 × 18% + 9000 × 5%
    expect(q.taxTotal.toFixed(2)).toBe("5310.00");
  });

  it("tax-inclusive prices keep the agreed gross", () => {
    const q = computeQuote([{ quantity: "1", unitPrice: "1180", taxRatePercent: "18" }], {
      pricesIncludeTax: true,
      supplyType: "INTRA",
    });
    expect(q.lines[0].taxableValue.toFixed(2)).toBe("1000.00");
    expect(q.taxTotal.toFixed(2)).toBe("180.00");
    expect(q.grandTotal.toFixed(2)).toBe("1180.00");
  });

  it("inclusive amounts that don't divide evenly still add up", () => {
    const q = computeQuote([{ quantity: "3", unitPrice: "333.33", taxRatePercent: "18" }], {
      pricesIncludeTax: true,
      supplyType: "INTRA",
    });
    const l = q.lines[0];
    expect(l.taxableValue.plus(l.cgst).plus(l.sgst).toFixed(2)).toBe("999.99");
    expect(q.grandTotal.toFixed(2)).toBe("999.99");
  });

  it("rounds the grand total to the rupee when asked, showing the difference", () => {
    const q = computeQuote([{ quantity: "1", unitPrice: "999.99", taxRatePercent: "18" }], {
      pricesIncludeTax: false,
      supplyType: "INTRA",
      roundGrandTotal: true,
    });
    // 999.99 + 90.00 + 90.00 (each half rounded) = 1179.99 → 1180
    expect(q.grandTotal.toFixed(2)).toBe("1180.00");
    expect(q.roundOff.toFixed(2)).toBe("0.01");
  });

  it("rejects impossible values", () => {
    expect(() =>
      computeQuote([{ quantity: "0", unitPrice: "10", taxRatePercent: "5" }], { pricesIncludeTax: false, supplyType: "INTRA" }),
    ).toThrow(QuoteError);
    expect(() =>
      computeQuote([{ quantity: "1", unitPrice: "10", discount: "11", taxRatePercent: "5" }], {
        pricesIncludeTax: false,
        supplyType: "INTRA",
      }),
    ).toThrow(/more than the line amount/);
    expect(() =>
      computeQuote([{ quantity: "1", unitPrice: "10", taxRatePercent: "5" }], {
        pricesIncludeTax: false,
        supplyType: "INTRA",
        bookingDiscount: "11",
      }),
    ).toThrow(/more than the quotation amount/);
  });

  it("a long wedding with 40 lines totals exactly", () => {
    const lines = Array.from({ length: 40 }, (_, i) => ({
      quantity: String(10 + i),
      unitPrice: `${100 + ((i * 37) % 900)}.${String(i % 100).padStart(2, "0")}`,
      discount: i % 5 === 0 ? "10.00" : "0",
      taxRatePercent: i % 2 ? "18" : "5",
    }));
    const q = computeQuote(lines, { pricesIncludeTax: false, supplyType: "INTRA", bookingDiscount: "2500.00" });
    expect(sumMoney(q.lines.map((l) => l.lineTotal)).toFixed(2)).toBe(q.grandTotal.toFixed(2));
    expect(q.taxableTotal.plus(q.taxTotal).toFixed(2)).toBe(q.grandTotal.toFixed(2));
  });
});

describe("ledger and balances", () => {
  const ledger = [
    { type: "PAYMENT" as const, direction: "IN" as const, amount: "100000" },
    { type: "PAYMENT" as const, direction: "IN" as const, amount: "150000" },
    { type: "REFUND" as const, direction: "OUT" as const, amount: "20000" },
    { type: "ADJUSTMENT" as const, direction: "OUT" as const, amount: "5000" },
  ];

  it("multi-instalment balance with refund and adjustment", () => {
    const t = ledgerTotals(ledger);
    expect(t.netReceived.toFixed(2)).toBe("225000.00");
    const b = bookingBalance({ acceptedTotal: "444750", postEventTotal: "8925", ledger, deposits: [], cancelled: false });
    expect(b.outstanding.toFixed(2)).toBe("228675.00");
    expect(b.status).toBe("PARTLY_PAID");
  });

  it("deposits never count as revenue or reduce the balance", () => {
    const b = bookingBalance({
      acceptedTotal: "100000",
      postEventTotal: "0",
      ledger: [{ type: "PAYMENT", direction: "IN", amount: "100000" }],
      deposits: [
        { type: "RECEIVED", amount: "25000" },
        { type: "DEDUCTION", amount: "4000" },
        { type: "REFUNDED", amount: "21000" },
      ],
      cancelled: false,
    });
    expect(b.status).toBe("PAID");
    expect(b.outstanding.toFixed(2)).toBe("0.00");
    expect(b.deposit.held.toFixed(2)).toBe("0.00");
    expect(depositTotals([{ type: "RECEIVED", amount: "25000" }]).held.toFixed(2)).toBe("25000.00");
  });

  it("cancelled bookings show the refund still due, not an outstanding balance", () => {
    const b = bookingBalance({
      acceptedTotal: "500000",
      postEventTotal: "0",
      ledger: [{ type: "PAYMENT", direction: "IN", amount: "200000" }],
      deposits: [],
      cancelled: true,
      agreedRefund: "100000",
    });
    expect(b.outstanding.toFixed(2)).toBe("0.00");
    expect(b.refundStillDue.toFixed(2)).toBe("100000.00");
    expect(b.retained.toFixed(2)).toBe("100000.00");
  });

  it("owes no refund once the payment itself was reversed", () => {
    const b = bookingBalance({
      acceptedTotal: "500000",
      postEventTotal: "0",
      ledger: [
        { type: "PAYMENT", direction: "IN", amount: "200000" },
        { type: "ADJUSTMENT", direction: "OUT", amount: "200000" },
      ],
      deposits: [],
      cancelled: true,
      agreedRefund: "100000",
    });
    expect(b.refundStillDue.toFixed(2)).toBe("0.00");
    expect(b.retained.toFixed(2)).toBe("0.00");
  });

  it("allocates payments to the schedule in due order", () => {
    const rows = allocateToInstalments(
      "150000",
      [
        { id: "b", label: "Second", dueOn: "2026-12-01", amount: "100000" },
        { id: "a", label: "Advance", dueOn: "2026-11-01", amount: "100000" },
        { id: "c", label: "Final", dueOn: "2027-01-10", amount: "100000" },
      ],
      "2026-12-05",
    );
    expect(rows.map((r) => [r.id, r.status, r.paid.toFixed(2)])).toEqual([
      ["a", "PAID", "100000.00"],
      ["b", "OVERDUE", "50000.00"],
      ["c", "DUE", "0.00"],
    ]);
  });
});

describe("cancellation slabs", () => {
  const slabs = [
    { daysBeforeEventMin: 90, refundPercent: "75" },
    { daysBeforeEventMin: 30, refundPercent: "50" },
    { daysBeforeEventMin: 0, refundPercent: "0" },
  ];

  it("picks the slab the cancellation date still meets", () => {
    expect(cancellationRefund(slabs, 120, "200000").refundAmount.toFixed(2)).toBe("150000.00");
    expect(cancellationRefund(slabs, 90, "200000").refundAmount.toFixed(2)).toBe("150000.00");
    expect(cancellationRefund(slabs, 89, "200000").refundAmount.toFixed(2)).toBe("100000.00");
    expect(cancellationRefund(slabs, 3, "200000").refundAmount.toFixed(2)).toBe("0.00");
  });

  it("no matching slab means no refund", () => {
    expect(cancellationRefund([{ daysBeforeEventMin: 30, refundPercent: "50" }], 10, "1000").refundAmount.toFixed(2)).toBe("0.00");
    expect(cancellationRefund([], 400, "1000").slab).toBeNull();
  });
});
