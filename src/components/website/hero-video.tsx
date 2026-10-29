"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** "none" for reduced motion or Data Saver, otherwise the screen class. */
function playback(): "none" | "mobile" | "desktop" {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (reduced || connection?.saveData) return "none";
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

/**
 * Muted, looping venue film over the poster image. Phones get the smaller
 * `mobileSrc` file. Skipped for visitors who prefer reduced motion or have
 * Data Saver on — they keep the poster.
 */
export function HeroVideo({ src, mobileSrc, poster }: { src: string; mobileSrc?: string; poster?: string }) {
  // Server render: no video (poster only); the browser decides after hydration.
  const mode = useSyncExternalStore(subscribe, playback, () => "none" as const);
  if (mode === "none") return null;
  return (
    <video
      key={mode}
      className="absolute inset-0 -z-20 size-full object-cover"
      src={mode === "mobile" && mobileSrc ? mobileSrc : src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
    />
  );
}
