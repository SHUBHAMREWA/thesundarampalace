import { ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { IconChip, TONES, type Tone } from "./icon-chip";

const CYCLE: Tone[] = ["rose", "blue", "green", "amber", "plum", "gold"];

/** Tinted card colours per tone, like the coloured entries on the calendar. */
const TILE: Record<Tone, string> = {
  rose: "border-primary/25 bg-primary/5 hover:border-primary/60",
  blue: "border-info/25 bg-info/5 hover:border-info/60",
  green: "border-success/25 bg-success/5 hover:border-success/60",
  amber: "border-warning/25 bg-warning/5 hover:border-warning/60",
  plum: "border-primary-deep/20 bg-lavender/40 hover:border-primary-deep/50",
  gold: "border-gold/50 bg-gold/10 hover:border-gold",
  red: "border-danger/25 bg-danger/5 hover:border-danger/60",
};

const BAR: Record<Tone, string> = {
  rose: "bg-primary",
  blue: "bg-info",
  green: "bg-success",
  amber: "bg-warning",
  plum: "bg-primary-deep",
  gold: "bg-gold",
  red: "bg-danger",
};

/** Grid for quick tiles: small cards, six to a row on wide screens (three when `half`, beside the calendar). */
export function StatGrid({ children, half = false }: { children: ReactNode; half?: boolean }) {
  return <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", !half && "xl:grid-cols-6")}>{children}</div>;
}

/** Compact, colourful dashboard tile; a link lifts on hover and shows an arrow. */
export function StatTile({ label, value, icon, href, tone = 0 }: { label: string; value: ReactNode; icon: LucideIcon; href?: string; tone?: Tone | number }) {
  const name = typeof tone === "number" ? CYCLE[tone % CYCLE.length] : tone;
  const body = (
    <>
      <span className={cn("absolute inset-y-0 left-0 w-1", BAR[name])} aria-hidden="true" />
      <div className="flex items-start justify-between gap-2">
        <IconChip icon={icon} tone={name} size="sm" />
        {href ? <ArrowUpRight className="size-4 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" /> : null}
      </div>
      <p className={cn("mt-2 text-2xl leading-none font-semibold tracking-tight", TONES[name].split(" ").find((c) => c.startsWith("text-")))}>{value}</p>
      <p className="mt-1 text-xs leading-snug text-text-muted">{label}</p>
    </>
  );
  const className = cn("group relative block overflow-hidden rounded-lg border p-3 pl-4 transition-all", TILE[name]);
  return href ? (
    <Link href={href} className={cn(className, "hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] focus-visible:-translate-y-0.5")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
