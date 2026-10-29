"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Category filter for the gallery. Items are server-rendered (so they work
 * without JavaScript); filtering only toggles their visibility.
 */
export function GalleryFilter({
  categories,
  allLabel,
  filterLabel,
  children,
}: {
  categories: { key: string; label: string }[];
  allLabel: string;
  filterLabel: string;
  children: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    grid.current
      ?.querySelectorAll<HTMLElement>("[data-category]")
      .forEach((el) => {
        el.hidden = active !== null && el.dataset.category !== active;
      });
  }, [active]);

  const options = [
    { key: null, label: allLabel },
    ...categories.map((c) => ({ key: c.key as string | null, label: c.label })),
  ];

  return (
    <div>
      {categories.length ? (
        <div
          role="group"
          aria-label={filterLabel}
          className="mb-8 flex flex-wrap justify-center gap-2"
        >
          {options.map((option) => (
            <button
              key={option.key ?? "all"}
              type="button"
              aria-pressed={active === option.key}
              onClick={() => setActive(option.key)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active === option.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface hover:border-primary",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={grid} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}
