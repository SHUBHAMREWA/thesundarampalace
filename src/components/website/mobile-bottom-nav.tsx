"use client";

import { CalendarHeart, House, Mail, MapPin, Phone } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { isActivePath } from "./site-nav-link";
import { trackConversion } from "./tracked-link";

type Labels = {
  nav: string;
  home: string;
  contact: string;
  whatsapp: string;
  call: string;
  email: string;
  location: string;
  book: string;
};

const item =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] font-medium text-text-muted transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-primary";
const activeItem = "bg-primary/10 text-primary";
const glass =
  "border border-surface/60 bg-surface/70 shadow-card ring-1 ring-border/60 backdrop-blur-xl backdrop-saturate-150";
const option =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text transition-colors hover:bg-primary/10 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-primary";

function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("flex size-6 items-center justify-center", className)}>{children}</span>;
}

/**
 * Phones only: a floating glass bar at the bottom with Home, Contact, Location
 * and the booking form. Contact opens WhatsApp, Call and Email above the bar.
 * Each contact way and Location appear only when the business has entered them
 * in Settings.
 */
export function MobileBottomNav({
  whatsappHref,
  callHref,
  emailHref,
  directionsHref,
  labels,
}: {
  whatsappHref: string | null;
  callHref: string | null;
  emailHref: string | null;
  directionsHref: string | null;
  labels: Labels;
}) {
  const pathname = usePathname();
  const homeActive = pathname === "/";
  const bookActive = isActivePath(pathname, "/plan-your-event");
  // Remembers the page the menu was opened on, so it closes when the page changes.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const close = () => setOpenOn(null);
  const navRef = useRef<HTMLElement>(null);

  // Close on a tap outside and on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const hasContact = Boolean(whatsappHref || callHref || emailHref);

  return (
    <nav
      ref={navRef}
      aria-label={labels.nav}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden"
    >
      {open ? (
        <div id="mobile-contact-menu" className={cn("mb-2 flex flex-col gap-1 rounded-2xl p-2", glass)}>
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                trackConversion("whatsapp_click");
                close();
              }}
              className={option}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-whatsapp text-primary-foreground">
                <WhatsAppIcon className="size-5" />
              </span>
              {labels.whatsapp}
            </a>
          ) : null}
          {callHref ? (
            <a
              href={callHref}
              onClick={() => {
                trackConversion("call_click");
                close();
              }}
              className={option}
            >
              <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Phone className="size-4" aria-hidden="true" />
              </span>
              {labels.call}
            </a>
          ) : null}
          {emailHref ? (
            <a href={emailHref} onClick={close} className={option}>
              <span className="flex size-9 items-center justify-center rounded-full bg-primary-deep text-primary-foreground">
                <Mail className="size-4" aria-hidden="true" />
              </span>
              {labels.email}
            </a>
          ) : null}
        </div>
      ) : null}
      <div className={cn("flex items-stretch gap-1 rounded-full p-1.5", glass)}>
        <Link href="/" aria-current={homeActive ? "page" : undefined} className={cn(item, homeActive && activeItem)}>
          <Icon>
            <House className="size-5" aria-hidden="true" />
          </Icon>
          <span className="truncate">{labels.home}</span>
        </Link>
        {hasContact ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-contact-menu"
            onClick={() => setOpenOn(open ? null : pathname)}
            className={cn(item, open && activeItem)}
          >
            <Icon className="text-whatsapp">
              <WhatsAppIcon className="size-5" />
            </Icon>
            <span className="truncate">{labels.contact}</span>
          </button>
        ) : null}
        {directionsHref ? (
          <a
            href={directionsHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackConversion("directions_click")}
            className={item}
          >
            <Icon>
              <MapPin className="size-5" aria-hidden="true" />
            </Icon>
            <span className="truncate">{labels.location}</span>
          </a>
        ) : null}
        <Link
          href="/plan-your-event"
          aria-current={bookActive ? "page" : undefined}
          className={cn(item, "bg-primary text-primary-foreground", bookActive && "bg-primary-deep")}
        >
          <Icon>
            <CalendarHeart className="size-5" aria-hidden="true" />
          </Icon>
          <span className="truncate">{labels.book}</span>
        </Link>
      </div>
    </nav>
  );
}
