import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { IconChip, TONES, type Tone } from "./icon-chip";

const CYCLE: Tone[] = ["rose", "blue", "green", "amber", "plum", "gold"];

/** Same text → same tone, so a customer or category keeps its colour everywhere. */
export function toneFor(text: string): Tone {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return CYCLE[hash % CYCLE.length];
}

function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** Initials in a soft coloured circle (or a photo when given). */
export function PersonAvatar({ name, photoUrl, size = "md" }: { name: string; photoUrl?: string | null; size?: "md" | "xl" }) {
  const box = size === "xl" ? "size-24 text-2xl" : "size-9 text-xs";
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- signed, private Cloudinary URL
    return <img src={photoUrl} alt={`Photo of ${name}`} className={cn("shrink-0 rounded-full object-cover ring-2 ring-surface", box)} />;
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-surface", TONES[toneFor(name)], box)} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** A coloured pill, e.g. a customer category. */
export function TonePill({ children, tone }: { children: ReactNode; tone: Tone }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone])}>{children}</span>;
}

/** Card title with a small coloured icon. */
export function SectionTitle({ icon, tone, children }: { icon: Parameters<typeof IconChip>[0]["icon"]; tone: Tone; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2.5">
      <IconChip icon={icon} tone={tone} size="sm" />
      {children}
    </span>
  );
}
