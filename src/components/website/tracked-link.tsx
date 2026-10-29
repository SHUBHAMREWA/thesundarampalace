"use client";

import type { ComponentProps } from "react";

export type ConversionType = "whatsapp_click" | "call_click" | "directions_click" | "brochure_download";

/** Records a conversion (no personal data) without delaying navigation. */
export function trackConversion(type: ConversionType | "enquiry_submitted"): void {
  try {
    const body = JSON.stringify({
      type,
      page: window.location.pathname,
      locale: document.documentElement.lang,
    });
    if (!navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } });
    }
  } catch {
    // Analytics must never break the page.
  }
}

/** External link (wa.me, tel:) that records a conversion when clicked. */
export function TrackedLink({
  conversion,
  onClick,
  ...props
}: ComponentProps<"a"> & { conversion: ConversionType }) {
  return (
    <a
      {...props}
      onClick={(event) => {
        trackConversion(conversion);
        onClick?.(event);
      }}
    />
  );
}
