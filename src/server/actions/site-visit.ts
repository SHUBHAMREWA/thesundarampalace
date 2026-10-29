"use server";

import { headers } from "next/headers";
import { clientIp, consumeRateLimit, rateLimitKey } from "@/server/services/rate-limit";
import { bookSiteVisit, siteVisitSchema } from "@/server/services/site-visit";

export type SiteVisitActionState = {
  success?: boolean;
  reference?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function bookSiteVisitAction(
  _prevState: SiteVisitActionState,
  formData: FormData,
): Promise<SiteVisitActionState> {
  const reqHeaders = await headers();
  const ip = clientIp(reqHeaders);

  // Rate limit: 10 attempts per 10 minutes
  const allowed = await consumeRateLimit(rateLimitKey("sitevisit-ip", ip), 10, 600);
  if (!allowed) {
    return {
      error: "Too many requests. Please wait a few minutes before trying again or call us directly.",
    };
  }

  const raw = {
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    visitDate: formData.get("visitDate"),
    timeSlot: formData.get("timeSlot"),
    preferredHallSlug: formData.get("preferredHallSlug") || undefined,
    notes: formData.get("notes") || undefined,
    consent: formData.get("consent") === "true" || formData.get("consent") === "on",
  };

  const parsed = siteVisitSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0]) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
    }
    return { fieldErrors, error: "Please correct the highlighted fields." };
  }

  try {
    const result = await bookSiteVisit(parsed.data, {
      pagePath: "/site-visit",
      ip,
      userAgent: reqHeaders.get("user-agent"),
    });

    return {
      success: true,
      reference: result.reference,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to book site visit";
    return { error: msg };
  }
}
