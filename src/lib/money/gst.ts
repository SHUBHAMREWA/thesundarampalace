import type Decimal from "decimal.js";

import { money, roundMoney, type MoneyInput } from "./money";

/**
 * GST split for one line. Rates always come from Settings (never hardcoded)
 * and must be confirmed by the business's accountant.
 *
 * INTRA: business state = place of supply → CGST + SGST, each half the rate.
 * INTER: different states → IGST at the full rate.
 */
export type SupplyType = "INTRA" | "INTER";

export type LineTax = {
  taxableValue: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  totalTax: Decimal;
  lineTotal: Decimal;
};

export function supplyTypeFor(
  businessStateCode: string,
  placeOfSupplyStateCode: string,
): SupplyType {
  return businessStateCode === placeOfSupplyStateCode ? "INTRA" : "INTER";
}

/** Tax-exclusive pricing: tax is added on top of the taxable value. */
export function taxOnTaxableValue(
  taxableValue: MoneyInput,
  ratePercent: MoneyInput,
  supply: SupplyType,
): LineTax {
  const taxable = roundMoney(taxableValue);
  const rate = money(ratePercent);
  let cgst = roundMoney(0);
  let sgst = roundMoney(0);
  let igst = roundMoney(0);
  if (supply === "INTRA") {
    const half = rate.dividedBy(2);
    cgst = roundMoney(taxable.times(half).dividedBy(100));
    sgst = roundMoney(taxable.times(half).dividedBy(100));
  } else {
    igst = roundMoney(taxable.times(rate).dividedBy(100));
  }
  const totalTax = cgst.plus(sgst).plus(igst);
  return { taxableValue: taxable, cgst, sgst, igst, totalTax, lineTotal: taxable.plus(totalTax) };
}

/**
 * Tax-inclusive pricing: back-calculate the taxable value from the gross
 * amount. Any rounding difference is absorbed by the taxable value so the
 * line total always equals the gross amount the customer agreed to.
 */
export function taxFromInclusiveAmount(
  grossAmount: MoneyInput,
  ratePercent: MoneyInput,
  supply: SupplyType,
): LineTax {
  const gross = roundMoney(grossAmount);
  const rate = money(ratePercent);
  const estimatedTaxable = roundMoney(gross.dividedBy(rate.dividedBy(100).plus(1)));
  const tax = taxOnTaxableValue(estimatedTaxable, rate, supply);
  const taxable = gross.minus(tax.totalTax);
  return { ...tax, taxableValue: taxable, lineTotal: gross };
}
