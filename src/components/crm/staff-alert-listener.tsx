"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

/**
 * While the CRM is open, a staff alert pushed to this device (see
 * public/sw.js) also refreshes the page — bell count, lead list — and shows a
 * toast with a link, so nothing waits for a reload.
 */
export function StaffAlertListener() {
  const router = useRouter();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        type?: string;
        title?: string;
        body?: string;
        url?: string;
      } | null;
      if (data?.type !== "staff-alert") return;
      router.refresh();
      const url = data.url;
      toast(data.title ?? "New notification", {
        description: data.body || undefined,
        action: url ? { label: "Open", onClick: () => router.push(url) } : undefined,
      });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);
  return null;
}
