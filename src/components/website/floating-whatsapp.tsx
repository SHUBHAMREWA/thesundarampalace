"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { trackConversion } from "./tracked-link";

/**
 * Floating WhatsApp button (mobile). Hides itself while any element marked
 * `data-hide-floating` (e.g. a form's submit button) is on screen.
 */
export function FloatingWhatsApp({ href, label }: { href: string; label: string }) {
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

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      onClick={() => trackConversion("whatsapp_click")}
      className={`fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full bg-success text-primary-foreground shadow-card transition-opacity md:hidden ${
        hidden ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <MessageCircle className="size-6" aria-hidden="true" />
    </a>
  );
}
