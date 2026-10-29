"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type Photo = { src: string; title: string; alt: string };

/**
 * Opens photos in a large view. Wraps server-rendered tiles: every link marked
 * `data-lightbox` (see PhotoTile) opens here instead of navigating, and the
 * arrows move through the visible photos in the group. Without JavaScript the
 * link simply opens the full-size photo.
 */
export function LightboxGroup({
  children,
  labels,
  className,
}: {
  children: ReactNode;
  labels: { close: string; previous: string; next: string };
  className?: string;
}) {
  const group = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [index, setIndex] = useState<number | null>(null);

  const close = useCallback(() => {
    setIndex(null);
    opener.current?.focus();
  }, []);
  const go = useCallback((step: number) => setIndex((i) => (i === null ? i : (i + step + photos.length) % photos.length)), [photos.length]);

  function onClick(event: React.MouseEvent) {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[data-lightbox]");
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    // Only photos currently shown (the gallery filter hides other categories).
    const links = [...(group.current?.querySelectorAll<HTMLAnchorElement>("a[data-lightbox]") ?? [])].filter((a) => a.offsetParent !== null);
    setPhotos(links.map((a) => ({ src: a.href, title: a.dataset.title ?? "", alt: a.dataset.alt ?? "" })));
    setIndex(Math.max(0, links.indexOf(link)));
    opener.current = link;
  }

  useEffect(() => {
    if (index === null) return;
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, close, go]);

  const photo = index === null ? null : photos[index];
  const button =
    "flex size-11 items-center justify-center rounded-full bg-primary-foreground/10 text-primary-foreground transition-colors hover:bg-primary-foreground/25";

  return (
    <div ref={group} onClick={onClick} className={className}>
      {children}
      {photo ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={photo.title || photo.alt}
          className="fixed inset-0 z-50 flex flex-col bg-primary-deep/95 text-primary-foreground backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="flex items-center justify-between p-3 md:p-4">
            <p className="text-sm text-blush" aria-live="polite">
              {index! + 1} / {photos.length}
            </p>
            <button ref={closeButton} type="button" onClick={close} aria-label={labels.close} className={button}>
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 md:px-20" onClick={(event) => event.target === event.currentTarget && close()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- full-size Cloudinary photo in the large view */}
            <img src={photo.src} alt={photo.alt || photo.title} className="max-h-full max-w-full rounded-md object-contain shadow-card" />
            {photos.length > 1 ? (
              <>
                <button type="button" onClick={() => go(-1)} aria-label={labels.previous} className={`${button} absolute left-2 md:left-6`}>
                  <ChevronLeft className="size-6" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => go(1)} aria-label={labels.next} className={`${button} absolute right-2 md:right-6`}>
                  <ChevronRight className="size-6" aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>
          <p className="min-h-14 px-4 py-4 text-center font-display text-xl md:text-2xl">{photo.title}</p>
        </div>
      ) : null}
    </div>
  );
}
