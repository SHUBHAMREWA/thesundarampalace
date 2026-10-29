"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const INTERVAL_MS = 6000;

/**
 * Cross-fading hero slideshow. Slides are server-rendered images passed as
 * children. Auto-advance stops for visitors who prefer reduced motion and
 * while the pointer is on the arrows or dots (not the whole hero, where a
 * resting mouse would stop it for good); arrows and dots always work.
 */
export function HeroSlideshow({
  children,
  labels,
}: {
  children: ReactNode;
  labels: { previous: string; next: string; slide: string };
}) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [count, paused]);

  const go = (step: number) => setIndex((i) => (i + step + count) % count);

  return (
    // No z-index here: the photos sit behind the hero's tint (-z-20) while the
    // arrows and dots sit above it (z-20), so the tint never blocks clicks.
    <div className="pointer-events-none absolute inset-0">
      {slides.map((slide, i) => (
        <div
          key={i}
          className={cn(
            "absolute inset-0 -z-20 transition-opacity duration-1000 motion-reduce:transition-none",
            i === index ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={i !== index}
        >
          {slide}
        </div>
      ))}
      {count > 1 ? (
        <div
          className="pointer-events-auto"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={labels.previous}
            className="absolute top-1/2 left-3 z-20 hidden -translate-y-1/2 rounded-full bg-primary-deep/40 p-2 text-primary-foreground backdrop-blur-sm transition-colors hover:bg-primary-deep/70 md:block"
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={labels.next}
            className="absolute top-1/2 right-3 z-20 hidden -translate-y-1/2 rounded-full bg-primary-deep/40 p-2 text-primary-foreground backdrop-blur-sm transition-colors hover:bg-primary-deep/70 md:block"
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
          <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${labels.slide} ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index
                    ? "w-6 bg-gold"
                    : "w-2 bg-primary-foreground/60 hover:bg-primary-foreground",
                )}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
