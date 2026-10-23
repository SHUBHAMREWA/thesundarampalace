import type Decimal from "decimal.js";

import { money, roundMoney, type MoneyInput } from "@/lib/money";
import { dateFromKey } from "@/lib/time";

/**
 * Season / weekday / named-date pricing rules. They adjust the default price
 * when a new quotation line is priced, and never touch existing quotations,
 * bookings or invoices (banquet-business-rules skill).
 */
export type PricingTarget = "PLATES" | "PACKAGE" | "SERVICE";

export type PricingRuleInput = {
  id: string;
  name: string;
  kind: "SEASON" | "WEEKDAY" | "DATE";
  startDate: string | null; // "YYYY-MM-DD"
  endDate: string | null;
  weekdays: number[] | null; // 0 = Sunday
  dates: string[] | null;
  adjustmentType: "PERCENT" | "AMOUNT";
  adjustmentValue: string;
  appliesTo: "ALL" | PricingTarget;
  active: boolean;
};

export function ruleMatches(rule: PricingRuleInput, date: string, target: PricingTarget): boolean {
  if (!rule.active) return false;
  if (rule.appliesTo !== "ALL" && rule.appliesTo !== target) return false;
  switch (rule.kind) {
    case "SEASON":
      return !!rule.startDate && !!rule.endDate && date >= rule.startDate && date <= rule.endDate;
    case "WEEKDAY":
      return (rule.weekdays ?? []).includes(dateFromKey(date).getUTCDay());
    case "DATE":
      return (rule.dates ?? []).includes(date);
  }
}

/**
 * Applies every matching rule in order: percentages to the running price,
 * amounts added (negative values are discounts). Never goes below zero.
 */
export function applyPricingRules(
  basePrice: MoneyInput,
  date: string,
  target: PricingTarget,
  rules: PricingRuleInput[],
): { price: Decimal; applied: { id: string; name: string }[] } {
  let price = roundMoney(basePrice);
  const applied: { id: string; name: string }[] = [];
  for (const rule of rules) {
    if (!ruleMatches(rule, date, target)) continue;
    const value = money(rule.adjustmentValue);
    price =
      rule.adjustmentType === "PERCENT"
        ? roundMoney(price.plus(price.times(value).dividedBy(100)))
        : roundMoney(price.plus(value));
    applied.push({ id: rule.id, name: rule.name });
  }
  if (price.isNegative()) price = roundMoney(0);
  return { price, applied };
}
