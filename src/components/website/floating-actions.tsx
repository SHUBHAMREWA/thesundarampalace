"use client";

import { MapPin } from "lucide-react";
import { useEffect, useState } from "react";

import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { cn } from "@/lib/utils";

import { trackConversion } from "./tracked-link";

type Action = { href: string; label: string };

/**
 * Floating location and WhatsApp buttons, fixed bottom-right on every screen
 * size. Both hide while any element marked `data-hide-floating` (e.g. a
 * form's submit button) is on screen, so they never cover it.
 */
export function FloatingActions({ whatsapp, directions }: { whatsapp: Action | null; directions: Action | null }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const targets = document.querySelectorAll("[data-hide-floating]");
    if (!targets.length) return;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setHidden(visible.size > 0);
    });
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  if (!whatsapp && !directions) return null;
  const button =
    "group relative flex size-12 items-center justify-center rounded-full text-primary-foreground shadow-card ring-2 ring-surface transition-transform hover:scale-105 focus-visible:scale-105 md:size-14";
  const tip =
    "pointer-events-none absolute right-full mr-3 hidden rounded-md bg-primary-deep px-2.5 py-1 text-xs font-medium whitespace-nowrap text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:block";

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-40 flex flex-col items-center gap-3 transition-opacity md:right-6 md:bottom-6",
        hidden ? "pointer-events-none opacity-0" : "opacity-100",
      )}
    >
      {directions ? (
        <a
          href={directions.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={directions.label}
          onClick={() => trackConversion("directions_click")}
          className={cn(button, "bg-primary")}
        >
          <MapPin className="size-5 md:size-6" aria-hidden="true" />
          <span className={tip}>{directions.label}</span>
        </a>
      ) : null}
      {whatsapp ? (
        <a
          href={whatsapp.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={whatsapp.label}
          onClick={() => trackConversion("whatsapp_click")}
          className={cn(button, "bg-whatsapp")}
        >
          <WhatsAppIcon className="size-6 md:size-7" />
          <span className={tip}>{whatsapp.label}</span>
        </a>
      ) : null}
    </div>
  );
}
