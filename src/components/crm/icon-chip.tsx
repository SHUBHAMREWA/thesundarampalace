import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Colour accents for CRM icons, from Rose Mahal tokens only. Tints stay light
 * so the CRM feels lively without competing with the content.
 */
export const TONES = {
  rose: "bg-primary/10 text-primary",
  blue: "bg-info/10 text-info",
  green: "bg-success/10 text-success",
  amber: "bg-warning/10 text-warning",
  plum: "bg-lavender text-primary-deep",
  gold: "bg-gold/20 text-warning",
  red: "bg-danger/10 text-danger",
} as const;
export type Tone = keyof typeof TONES;

const CYCLE: Tone[] = ["rose", "blue", "green", "amber", "plum", "gold"];

/** An icon in a soft coloured square. `tone` may be a name or an index (cycles through the palette). */
export function IconChip({ icon: Icon, tone = "rose", size = "md", className }: { icon: LucideIcon; tone?: Tone | number; size?: "sm" | "md" | "lg"; className?: string }) {
  const name = typeof tone === "number" ? CYCLE[tone % CYCLE.length] : tone;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        TONES[name],
        size === "sm" ? "size-7 [&>svg]:size-4" : size === "lg" ? "size-14 rounded-full [&>svg]:size-7" : "size-9 [&>svg]:size-[18px]",
        className,
      )}
      aria-hidden="true"
    >
      <Icon />
    </span>
  );
}
