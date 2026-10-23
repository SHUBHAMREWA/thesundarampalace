import { z } from "zod";

/**
 * GST state / union-territory codes (first two digits of a GSTIN; used for
 * place of supply). Public reference data, not business facts.
 * Codes 25 (old Daman & Diu) and 28 (old Andhra Pradesh) are no longer issued.
 */
export const GST_STATES: readonly { code: string; name: string }[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
];

const STATE_CODES = new Set(GST_STATES.map((s) => s.code));

export function isGstStateCode(code: string): boolean {
  return STATE_CODES.has(code);
}

export function gstStateName(code: string | null | undefined): string | null {
  if (!code) return null;
  return GST_STATES.find((s) => s.code === code)?.name ?? null;
}

export function gstStateLabel(code: string | null | undefined): string {
  const name = gstStateName(code);
  return name ? `${name} (${code})` : "—";
}

const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** GSTIN check character (mod-36 weighted sum used by the GST network). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = GSTIN_CHARS.indexOf(first14[i]);
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_CHARS[(36 - (sum % 36)) % 36];
}

/** Format, state code and check character. Doesn't prove the GSTIN is registered. */
export function isValidGstin(value: string): boolean {
  const gstin = value.trim().toUpperCase();
  if (!GSTIN_PATTERN.test(gstin)) return false;
  if (!isGstStateCode(gstin.slice(0, 2))) return false;
  return gstinCheckChar(gstin.slice(0, 14)) === gstin[14];
}

/** Optional GSTIN field: empty → null, otherwise a valid upper-case GSTIN. */
export const optionalGstinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .optional()
  .refine((v) => !v || isValidGstin(v), "Enter a valid 15-character GSTIN")
  .transform((v) => (v ? v : null));

export const optionalStateCodeSchema = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || isGstStateCode(v), "Choose a state")
  .transform((v) => (v ? v : null));

/** SAC codes are digits (services usually have 6, starting with 99). The accountant confirms them. */
export const sacCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, "Enter the SAC code (digits only)");
