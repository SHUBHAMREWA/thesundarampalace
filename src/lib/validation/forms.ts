import { z } from "zod";

import { money } from "@/lib/money";
import { isDateKey, isTimeOfDay } from "@/lib/time";

import { normalizePhone } from "./phone";

/**
 * Small Zod building blocks for CRM forms. Form values arrive as strings;
 * empty strings become null.
 */

export const optionalText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters`)
    .optional()
    .transform((v) => (v ? v : null));

export const requiredText = (label: string, max = 200) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `At most ${max} characters`);

export const optionalEmail = z
  .union([z.literal(""), z.email("Enter a valid email")])
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null));

export const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
      return z.NEVER;
    }
    return normalized;
  });

/** "YYYY-MM-DD" from <input type="date">. */
export const dateKeySchema = z
  .string({ error: "Choose a date" })
  .trim()
  .refine((v) => isDateKey(v), "Choose a valid date");

export const optionalDateKey = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || isDateKey(v), "Choose a valid date")
  .transform((v) => (v ? v : null));

export const timeSchema = z
  .string({ error: "Enter a time" })
  .trim()
  .refine((v) => isTimeOfDay(v), "Choose a time");

export const optionalTime = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || isTimeOfDay(v), "Use 24-hour time, e.g. 18:30")
  .transform((v) => (v ? v : null));

export const optionalPositiveInt = (max = 100_000) =>
  z
    .union([z.literal(""), z.coerce.number().int("Whole numbers only").min(1, "Enter a positive number").max(max)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v));

export const positiveInt = (label: string, max = 100_000) =>
  z.coerce.number({ error: `Enter ${label}` }).int("Whole numbers only").min(1, `Enter ${label}`).max(max);

const MONEY_RE = /^\d{1,10}(\.\d{1,2})?$/;

/** Rupee amount as a string with at most 2 decimals; never a JS float. */
export const moneyString = (label = "an amount") =>
  z
    .string({ error: `Enter ${label}` })
    .trim()
    .transform((v) => v.replace(/,/g, ""))
    .refine((v) => MONEY_RE.test(v), `Enter ${label} in rupees, e.g. 25000 or 25000.50`)
    .transform((v) => money(v).toFixed(2));

export const positiveMoneyString = (label = "an amount") =>
  moneyString(label).refine((v) => money(v).greaterThan(0), `Enter ${label} greater than zero`);

export const optionalMoneyString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ?? "").replace(/,/g, ""))
  .refine((v) => !v || MONEY_RE.test(v), "Enter an amount in rupees, e.g. 25000")
  .transform((v) => (v ? money(v).toFixed(2) : null));

/** Quantity with up to 3 decimals (hours, plates, units). */
export const quantityString = z
  .string({ error: "Enter a quantity" })
  .trim()
  .refine((v) => /^\d{1,7}(\.\d{1,3})?$/.test(v) && money(v).greaterThan(0), "Enter a quantity greater than zero")
  .transform((v) => money(v).toFixed(3));

export const percentString = z
  .string({ error: "Enter a percentage" })
  .trim()
  .refine((v) => /^\d{1,3}(\.\d{1,2})?$/.test(v) && money(v).lessThanOrEqualTo(100), "Enter a percentage between 0 and 100")
  .transform((v) => money(v).toFixed(2));

export const checkboxBool = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.literal("false")])
  .optional()
  .transform((v) => v === "on" || v === "true");

/** Idempotency key sent by each money form (a random UUID made when the form renders). */
export const idempotencyKeySchema = z
  .string({ error: "This form has expired. Reload the page and try again." })
  .regex(/^[0-9a-f-]{36}$/i, "This form has expired. Reload the page and try again.");
