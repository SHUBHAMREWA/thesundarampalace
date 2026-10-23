import { z } from "zod";

import { normalizePhone } from "./phone";

/**
 * "Plan your event" form — shared by the browser (step checks) and the server
 * (authoritative validation). Error messages are translation keys from
 * messages `enquiry.*`.
 */

export const CONTACT_PREFERENCES = ["whatsapp", "call", "email"] as const;

/** Today's date in Asia/Kolkata as YYYY-MM-DD. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const enquiryStep1Schema = z.object({
  eventTypeKey: z.string().trim().min(1, "required").max(50),
  preferredDate: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= todayIST()), "invalidDate"),
  guestsApprox: z
    .union([z.literal(""), z.coerce.number().int("invalidGuests").min(1, "invalidGuests").max(100_000, "invalidGuests")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v)),
});

export const enquiryStep2Schema = z.object({
  message: optionalText(2000),
  preferredHallSlug: optionalText(120),
});

export const enquiryStep3Schema = z.object({
  fullName: z.string().trim().min(2, "required").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "required")
    .transform((value, ctx) => {
      const normalized = normalizePhone(value);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "invalidPhone" });
        return z.NEVER;
      }
      return normalized;
    }),
  email: z
    .union([z.literal(""), z.email("invalidEmail").trim().toLowerCase().max(200)])
    .optional()
    .transform((v) => (v ? v : undefined)),
  contactPreference: z.enum(CONTACT_PREFERENCES).default("whatsapp"),
  consent: z.literal(true, { error: "consentRequired" }),
});

export const enquirySchema = enquiryStep1Schema.extend(enquiryStep2Schema.shape).extend(enquiryStep3Schema.shape);
export type EnquiryInput = z.infer<typeof enquirySchema>;

/** Attribution captured in the browser (UTM, referrer, landing page). */
export const attributionSchema = z
  .object({
    utm: z
      .object({
        source: z.string().max(200).optional(),
        medium: z.string().max(200).optional(),
        campaign: z.string().max(200).optional(),
        term: z.string().max(200).optional(),
        content: z.string().max(200).optional(),
      })
      .default({}),
    referrer: z.string().max(500).nullable().default(null),
    landingPage: z.string().max(300).default("/"),
  })
  .catch({ utm: {}, referrer: null, landingPage: "/" });
export type AttributionInput = z.infer<typeof attributionSchema>;

/** Reads the enquiry fields out of a submitted form. */
export function enquiryFromForm(form: FormData): Record<string, unknown> {
  const text = (name: string) => {
    const v = form.get(name);
    return typeof v === "string" ? v : undefined;
  };
  return {
    eventTypeKey: text("eventTypeKey") ?? "",
    preferredDate: text("preferredDate"),
    guestsApprox: text("guestsApprox"),
    message: text("message"),
    preferredHallSlug: text("preferredHallSlug"),
    fullName: text("fullName") ?? "",
    phone: text("phone") ?? "",
    email: text("email"),
    contactPreference: text("contactPreference") || "whatsapp",
    consent: form.get("consent") === "on" || form.get("consent") === "true",
  };
}

/** Field errors as { field: translationKey }. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
