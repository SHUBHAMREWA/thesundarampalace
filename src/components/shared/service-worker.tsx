"use client";

import { useEffect } from "react";

/**
 * Registers the app's service worker (public/sw.js) so the site and CRM can be
 * installed and show an offline page. Production only: in development it
 * would cache files that keep changing.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Not supported or blocked: the site works the same without it.
    });
  }, []);
  return null;
}
