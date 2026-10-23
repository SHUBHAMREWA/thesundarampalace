import Decimal from "decimal.js";

/**
 * All money arithmetic goes through this module (CLAUDE.md rule 2).
 * Never use JS number arithmetic for money; React components only format.
 */
export const Money = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});
export type Money = Decimal;

/** Values accepted as money input. Numbers are allowed only as whole rupees. */
export type MoneyInput = string | Decimal | { toString(): string } | number;

export function money(value: MoneyInput): Decimal {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new TypeError(
        "Fractional numbers are not accepted as money; pass a string or Decimal",
      );
    }
    return new Money(value);
  }
  const d = new Money(value.toString());
  if (!d.isFinite()) throw new TypeError(`Invalid money value: ${value}`);
  return d;
}

/** Round to paise using ROUND_HALF_UP. */
export function roundMoney(value: MoneyInput): Decimal {
  return money(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export function sumMoney(values: MoneyInput[]): Decimal {
  return roundMoney(values.reduce<Decimal>((acc, v) => acc.plus(money(v)), new Money(0)));
}

/** `ratePercent` of `amount`, rounded to paise. */
export function percentOf(amount: MoneyInput, ratePercent: MoneyInput): Decimal {
  return roundMoney(money(amount).times(money(ratePercent)).dividedBy(100));
}

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,25,000.00 — Indian digit grouping. */
export function formatINR(value: MoneyInput): string {
  const d = roundMoney(value);
  // Intl only accepts numbers/strings; the string form keeps full precision.
  return inrFormatter.format(d.toFixed(2) as unknown as number);
}
