import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

/**
 * Indian mobile numbers (10 digits, optional +91 / 0 prefix) and valid
 * international numbers are accepted. Stored in E.164 form (+919812345678).
 */
export function normalizePhone(input: string): string | null {
  const cleaned = input.trim();
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, "IN");
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform((value, ctx) => {
    const normalized = normalizePhone(value);
    if (!normalized) {
      ctx.addIssue({ code: "custom", message: "Enter a valid mobile number" });
      return z.NEVER;
    }
    return normalized;
  });

/** For logs and lists: "+919812345621" → "98******21". */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const national = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (national.length < 4) return "****";
  return `${national.slice(0, 2)}${"*".repeat(national.length - 4)}${national.slice(-2)}`;
}
