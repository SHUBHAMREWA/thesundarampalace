"use client";

import { useEffect } from "react";

export const ATTRIBUTION_KEY = "sp_attribution";

export type Attribution = {
  utm: Partial<Record<"source" | "medium" | "campaign" | "term" | "content", string>>;
  referrer: string | null;
  landingPage: string;
};

/**
 * Remembers how the visitor arrived (UTM tags, referrer, landing page) for the
 * rest of the visit, in sessionStorage — no cookies, nothing sent anywhere
 * until the visitor submits an enquiry.
 */
export function UtmCapture() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(ATTRIBUTION_KEY)) return;
      const params = new URLSearchParams(window.location.search);
      const utm: Attribution["utm"] = {};
      for (const key of ["source", "medium", "campaign", "term", "content"] as const) {
        const value = params.get(`utm_${key}`);
        if (value) utm[key] = value.slice(0, 200);
      }
      const referrer =
        document.referrer && new URL(document.referrer).origin !== window.location.origin
          ? document.referrer.slice(0, 500)
          : null;
      const attribution: Attribution = { utm, referrer, landingPage: window.location.pathname };
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    } catch {
      // Private browsing or storage disabled — attribution is optional.
    }
  }, []);
  return null;
}

export function readAttribution(): Attribution | null {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}
