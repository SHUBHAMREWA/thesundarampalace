"use server";

import { headers } from "next/headers";
import { after } from "next/server";

import { routing } from "@/i18n/routing";
import {
  attributionSchema,
  enquiryFromForm,
  enquirySchema,
  fieldErrorsOf,
} from "@/lib/validation/enquiry";
import { createLeadFromEnquiry } from "@/server/services/enquiry";
import { deliverPendingOutbox } from "@/server/services/notifications";
import { clientIp, consumeRateLimit, rateLimitKey } from "@/server/services/rate-limit";

export type EnquiryState =
  | { status: "idle" }
  | { status: "success"; reference: string }
  | { status: "error"; code: "validation" | "rate_limited" | "server"; fieldErrors?: Record<string, string> };

/** Bots fill hidden fields and submit instantly; people don't. */
const MIN_FILL_MS = 2500;

/**
 * Public "Plan your event" submission. Server-side validation, honeypot,
 * minimum fill time and rate limits (per connection and per phone) run
 * before anything is stored.
 */
export async function submitEnquiry(_prev: EnquiryState, form: FormData): Promise<EnquiryState> {
  const requestHeaders = await headers();

  // Honeypot / too fast: pretend success so bots learn nothing.
  const startedAt = Number(form.get("startedAt"));
  if (String(form.get("website") ?? "") !== "" || !startedAt || Date.now() - startedAt < MIN_FILL_MS) {
    return { status: "success", reference: "SP-L-received" };
  }

  const ipKey = rateLimitKey("enquiry-ip", clientIp(requestHeaders));
  if (!(await consumeRateLimit(ipKey, 5, 10 * 60))) {
    return { status: "error", code: "rate_limited" };
  }

  const parsed = enquirySchema.safeParse(enquiryFromForm(form));
  if (!parsed.success) {
    return { status: "error", code: "validation", fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const phoneKey = rateLimitKey("enquiry-phone", parsed.data.phone);
  if (!(await consumeRateLimit(phoneKey, 3, 60 * 60))) {
    return { status: "error", code: "rate_limited" };
  }

  const localeValue = String(form.get("locale") ?? "");
  const locale = (routing.locales as readonly string[]).includes(localeValue) ? localeValue : routing.defaultLocale;
  let attribution;
  try {
    attribution = attributionSchema.parse(JSON.parse(String(form.get("attribution") ?? "{}")));
  } catch {
    attribution = attributionSchema.parse({});
  }

  try {
    const result = await createLeadFromEnquiry(parsed.data, {
      locale,
      sourceKey: "website_form",
      pagePath: String(form.get("pagePath") ?? "").slice(0, 300) || "/",
      attribution,
    });
    // Deliver staff emails after the response is sent.
    after(() => deliverPendingOutbox());
    return { status: "success", reference: result.reference };
  } catch (error) {
    console.error("Enquiry submission failed", error instanceof Error ? error.message : error);
    return { status: "error", code: "server" };
  }
}
