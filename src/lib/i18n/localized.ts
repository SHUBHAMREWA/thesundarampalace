import { z } from "zod";

/**
 * CMS text stored per language. English is the fallback whenever Hindi is
 * empty (MASTER_PROMPT §5 "Language").
 */
export type Localized = { en: string; hi?: string };
export type ContentLocale = "en" | "hi";

export function isLocalized(value: unknown): value is Localized {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).en === "string"
  );
}

/** Text for `locale`, falling back to English; "" when nothing is set. */
export function t(value: unknown, locale: string): string {
  if (!isLocalized(value)) return "";
  if (locale === "hi" && value.hi?.trim()) return value.hi;
  return value.en ?? "";
}

/** True when the field has any English text. */
export function hasText(value: unknown): boolean {
  return isLocalized(value) && value.en.trim().length > 0;
}

const trimmed = z.string().trim().max(20_000);

/** English required (e.g. titles, alt text). */
export const localizedRequired = z.object({
  en: trimmed.min(1, "English text is required"),
  hi: trimmed.optional().transform((v) => (v ? v : undefined)),
});

/** Both optional; stored as null when empty. */
export const localizedOptional = z
  .object({
    en: trimmed.optional().default(""),
    hi: trimmed.optional().transform((v) => (v ? v : undefined)),
  })
  .transform((v) => (v.en || v.hi ? { en: v.en, ...(v.hi ? { hi: v.hi } : {}) } : null));

/** Reads `name.en` / `name.hi` from a submitted form. */
export function localizedFromForm(form: FormData, name: string): { en: string; hi: string } {
  return {
    en: String(form.get(`${name}.en`) ?? ""),
    hi: String(form.get(`${name}.hi`) ?? ""),
  };
}
