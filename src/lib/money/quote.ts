import Decimal from "decimal.js";

import { taxFromInclusiveAmount, taxOnTaxableValue, type SupplyType } from "./gst";
import { Money, money, roundMoney, sumMoney, type MoneyInput } from "./money";

/**
 * Quotation / invoice arithmetic (india-billing-gst skill):
 *  1. gross = quantity × unit price (rounded to paise)
 *  2. net = gross − line discount
 *  3. a quotation-level discount is spread over lines pro rata to net
 *  4. tax per line on what remains (CGST+SGST or IGST), inclusive or exclusive
 *  5. totals are sums of the rounded line values; optional round-off to ₹1
 */

export class QuoteError extends Error {
  constructor(
    message: string,
    readonly lineIndex?: number,
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

export type QuoteLineInput = {
  quantity: MoneyInput;
  unitPrice: MoneyInput;
  /** Absolute line discount in rupees. */
  discount?: MoneyInput;
  taxRatePercent: MoneyInput;
};

export type QuoteOptions = {
  pricesIncludeTax: boolean;
  supplyType: SupplyType;
  bookingDiscount?: MoneyInput;
  roundGrandTotal?: boolean;
};

export type QuoteLineResult = {
  gross: Decimal;
  discount: Decimal;
  allocatedDiscount: Decimal;
  taxableValue: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  lineTotal: Decimal;
};

export type QuoteTotals = {
  lines: QuoteLineResult[];
  subtotal: Decimal;
  discountTotal: Decimal;
  taxableTotal: Decimal;
  cgstTotal: Decimal;
  sgstTotal: Decimal;
  igstTotal: Decimal;
  taxTotal: Decimal;
  roundOff: Decimal;
  grandTotal: Decimal;
};

/**
 * Splits `amount` across `weights` pro rata, in paise, so the parts add up
 * exactly. Leftover paise go to the largest weights first (ties: earlier line).
 */
export function allocateProRata(amount: MoneyInput, weights: MoneyInput[]): Decimal[] {
  const total = roundMoney(amount);
  const w = weights.map((v) => money(v));
  const weightSum = w.reduce((acc, v) => acc.plus(v), new Money(0));
  if (total.isZero() || weightSum.isZero()) return w.map(() => roundMoney(0));
  const totalPaise = total.times(100);
  const raw = w.map((v) => totalPaise.times(v).dividedBy(weightSum));
  const floors = raw.map((v) => v.floor());
  let leftover = totalPaise.minus(floors.reduce((acc, v) => acc.plus(v), new Money(0))).toNumber();
  const order = w
    .map((v, i) => ({ i, v }))
    .sort((a, b) => b.v.comparedTo(a.v) || a.i - b.i)
    .map((x) => x.i);
  const paise = [...floors];
  for (let k = 0; leftover > 0 && order.length; k = (k + 1) % order.length) {
    paise[order[k]] = paise[order[k]].plus(1);
    leftover -= 1;
  }
  return paise.map((p) => roundMoney(p.dividedBy(100)));
}

export function computeQuote(inputs: QuoteLineInput[], options: QuoteOptions): QuoteTotals {
  const prepared = inputs.map((line, index) => {
    const quantity = money(line.quantity);
    const unitPrice = money(line.unitPrice);
    const discount = roundMoney(line.discount ?? 0);
    const rate = money(line.taxRatePercent);
    if (!quantity.greaterThan(0)) throw new QuoteError("Quantity must be more than zero", index);
    if (unitPrice.isNegative()) throw new QuoteError("Unit price can't be negative", index);
    if (discount.isNegative()) throw new QuoteError("Discount can't be negative", index);
    if (rate.isNegative() || rate.greaterThan(100)) throw new QuoteError("Tax rate must be between 0 and 100", index);
    const gross = roundMoney(quantity.times(unitPrice));
    if (discount.greaterThan(gross)) throw new QuoteError("Discount is more than the line amount", index);
    return { gross, discount, net: gross.minus(discount), rate };
  });

  const bookingDiscount = roundMoney(options.bookingDiscount ?? 0);
  if (bookingDiscount.isNegative()) throw new QuoteError("Discount can't be negative");
  const netSum = sumMoney(prepared.map((p) => p.net));
  if (bookingDiscount.greaterThan(netSum)) throw new QuoteError("Discount is more than the quotation amount");
  const allocations = allocateProRata(bookingDiscount, prepared.map((p) => p.net));

  const lines: QuoteLineResult[] = prepared.map((p, i) => {
    const amount = p.net.minus(allocations[i]);
    const tax = options.pricesIncludeTax
      ? taxFromInclusiveAmount(amount, p.rate, options.supplyType)
      : taxOnTaxableValue(amount, p.rate, options.supplyType);
    return {
      gross: p.gross,
      discount: p.discount,
      allocatedDiscount: allocations[i],
      taxableValue: tax.taxableValue,
      cgst: tax.cgst,
      sgst: tax.sgst,
      igst: tax.igst,
      lineTotal: tax.lineTotal,
    };
  });

  const subtotal = sumMoney(lines.map((l) => l.gross));
  const discountTotal = sumMoney(lines.flatMap((l) => [l.discount, l.allocatedDiscount]));
  const taxableTotal = sumMoney(lines.map((l) => l.taxableValue));
  const cgstTotal = sumMoney(lines.map((l) => l.cgst));
  const sgstTotal = sumMoney(lines.map((l) => l.sgst));
  const igstTotal = sumMoney(lines.map((l) => l.igst));
  const taxTotal = sumMoney([cgstTotal, sgstTotal, igstTotal]);
  const exact = sumMoney(lines.map((l) => l.lineTotal));
  const grandTotal = options.roundGrandTotal ? exact.toDecimalPlaces(0, Decimal.ROUND_HALF_UP) : exact;
  return {
    lines,
    subtotal,
    discountTotal,
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    taxTotal,
    roundOff: roundMoney(grandTotal.minus(exact)),
    grandTotal: roundMoney(grandTotal),
  };
}

/**
 * Credit for part of an invoice line: tax at the line's own rate and supply
 * type on the taxable value being credited.
 */
export function creditForTaxable(taxableValue: MoneyInput, ratePercent: MoneyInput, supplyType: SupplyType) {
  return taxOnTaxableValue(taxableValue, ratePercent, supplyType);
}
