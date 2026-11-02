"use client";

import { CalendarHeart, House, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { isActivePath } from "./site-nav-link";
import { trackConversion } from "./tracked-link";

type Labels = { nav: string; home: string; whatsapp: string; location: string; book: string };

const item =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] font-medium text-text-muted transition-colors active:scale-95 focus-visible:outline-2 focus-visible:outline-primary";
const activeItem = "bg-primary/10 text-primary";

function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("flex size-6 items-center justify-center", className)}>{children}</span>;
}

/**
 * Phones only: a floating glass bar at the bottom with Home, WhatsApp, Location and
 * the booking form. WhatsApp and Location appear only when the business has
 * entered the number and the address in Settings.
 */
export function MobileBottomNav({
  whatsappHref,
  directionsHref,
  labels,
}: {
  whatsappHref: string | null;
  directionsHref: string | null;
  labels: Labels;
}) {
  const pathname = usePathname();
  const homeActive = pathname === "/";
  const bookActive = isActivePath(pathname, "/plan-your-event");

  return (
    <nav
      aria-label={labels.nav}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 md:hidden"
    >
      <div className="flex items-stretch gap-1 rounded-full border border-surface/60 bg-surface/70 p-1.5 shadow-card ring-1 ring-border/60 backdrop-blur-xl backdrop-saturate-150">
        <Link href="/" aria-current={homeActive ? "page" : undefined} className={cn(item, homeActive && activeItem)}>
          <Icon>
            <House className="size-5" aria-hidden="true" />
          </Icon>
          <span className="truncate">{labels.home}</span>
        </Link>
        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackConversion("whatsapp_click")}
            className={item}
          >
            <Icon className="text-whatsapp">
              <WhatsAppIcon className="size-5" />
            </Icon>
            <span className="truncate">{labels.whatsapp}</span>
          </a>
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
