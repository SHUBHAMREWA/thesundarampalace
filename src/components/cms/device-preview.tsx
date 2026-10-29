"use client";

import { Monitor, Smartphone } from "lucide-react";

import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { cn } from "@/lib/utils";

/**
 * Where the photo will be shown on the website, so the preview crops it the
 * same way the public page does:
 * - hero:   the full-screen homepage hero (desktop ~16:10, phone ~9:16)
 * - banner: the title band at the top of inner pages (wide strip)
 * - tile:   4:3 photo tiles on the Venues, Décor and Celebrations pages and in carousels
 * - portrait: the 4:5 owner portrait on the About page
 * - avatar: the round guest photo on a testimonial
 * - wide: a 16:9 blog cover
 */
export type PreviewLayout = "hero" | "banner" | "tile" | "portrait" | "avatar" | "wide";

const FRAMES: Record<PreviewLayout, { desktop: string; mobile: string; mobileWidth: string; caption: string }> = {
  hero: { desktop: "aspect-[16/10]", mobile: "aspect-[9/16]", mobileWidth: "w-28", caption: "Full-screen homepage hero" },
  banner: { desktop: "aspect-[4/1]", mobile: "aspect-[5/4]", mobileWidth: "w-36", caption: "Title band at the top of the page" },
  tile: { desktop: "aspect-[4/3]", mobile: "aspect-[4/3]", mobileWidth: "w-36", caption: "Photo tile on the website (4:3)" },
  portrait: { desktop: "aspect-[4/5]", mobile: "aspect-[4/5]", mobileWidth: "w-28", caption: "Portrait frame (4:5)" },
  wide: { desktop: "aspect-video", mobile: "aspect-video", mobileWidth: "w-36", caption: "Blog cover (16:9)" },
  avatar: { desktop: "aspect-square rounded-full", mobile: "aspect-square rounded-full", mobileWidth: "w-14", caption: "Round guest photo on the review card" },
};

/** `src` is a Cloudinary public ID, or a local blob: URL for a file not yet uploaded. */
export function DevicePreview({ src, layout = "hero", className }: { src: string | null; layout?: PreviewLayout; className?: string }) {
  if (!src) return null;
  const url = src.startsWith("blob:") ? src : cloudinaryImageUrl(src, 1200);
  const frame = FRAMES[layout];
  return (
    <div className={cn("rounded-lg border border-border bg-bg p-4", className)}>
      <p className="mb-3 text-xs text-text-muted">
        Preview — {frame.caption}. The website crops the photo exactly like this.
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <figure className={cn("min-w-0 flex-1", layout === "tile" ? "basis-48 max-w-sm" : layout === "portrait" ? "max-w-48 basis-40" : layout === "avatar" ? "max-w-24 basis-20" : "basis-64")}>
          <figcaption className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <Monitor className="size-3.5" aria-hidden="true" /> Desktop
          </figcaption>
          <div className="overflow-hidden rounded-md border-4 border-primary-deep bg-primary-deep shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded or local image */}
            <img src={url} alt="" className={cn("w-full object-cover", frame.desktop)} />
          </div>
        </figure>
        <figure className={cn("shrink-0", frame.mobileWidth)}>
          <figcaption className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <Smartphone className="size-3.5" aria-hidden="true" /> Mobile
          </figcaption>
          <div className="overflow-hidden rounded-xl border-4 border-primary-deep bg-primary-deep shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded or local image */}
            <img src={url} alt="" className={cn("w-full object-cover", frame.mobile)} />
          </div>
        </figure>
      </div>
    </div>
  );
}
