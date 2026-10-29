"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useRef, type ReactNode } from "react";

/**
 * Horizontal picture strip with left/right buttons. Swipe works on touch
 * screens through native scroll-snap; the buttons move one picture at a time.
 */
export function PictureCarousel({ children, labels }: { children: ReactNode; labels: { previous: string; next: string } }) {
  const track = useRef<HTMLUListElement>(null);
  const items = Children.toArray(children);

  const move = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    const step = first ? first.offsetWidth + 16 : el.clientWidth;
    el.scrollBy({ left: direction * step, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className="relative">
      <ul ref={track} className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, i) => (
          <li key={i} className="w-[85%] shrink-0 snap-start sm:w-[48%] lg:w-[32%]">
            {item}
          </li>
        ))}
      </ul>
      {items.length > 1 ? (
        <div className="mt-4 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label={labels.previous}
            className="rounded-full border border-border bg-surface p-2.5 text-primary shadow-card transition-colors hover:border-primary hover:bg-blush"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label={labels.next}
            className="rounded-full border border-border bg-surface p-2.5 text-primary shadow-card transition-colors hover:border-primary hover:bg-blush"
          >
            <ChevronRight className="size-5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
