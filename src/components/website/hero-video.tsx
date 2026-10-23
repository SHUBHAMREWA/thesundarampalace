"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function motionAllowed(): boolean {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return !reduced && !connection?.saveData;
}

/**
 * Muted, looping venue film over the poster image. Skipped for visitors who
 * prefer reduced motion or have Data Saver on — they keep the poster.
 */
export function HeroVideo({ src }: { src: string }) {
  // Server render: no video (poster only); the browser decides after hydration.
  const play = useSyncExternalStore(subscribe, motionAllowed, () => false);
  if (!play) return null;
  return (
    <video
      className="absolute inset-0 -z-20 size-full object-cover"
      src={src}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
    />
  );
}
