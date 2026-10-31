"use client";

import { Crop, Monitor, Smartphone } from "lucide-react";

import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { cn } from "@/lib/utils";

/**
 * Where the photo will be shown on the website, so the preview crops it the
 * same way the public page does:
 * - hero:     the homepage hero, 85% of the screen tall (desktop ~16:9, phone ~9:16)
 * - banner:   the title band at the top of inner pages (desktop ~5:1 strip, phone ~3:2)
 * - tile:     4:3 photo tiles on the Venues, Catering, Décor and Celebrations pages and in carousels
 * - gallery:  4:3 on the Gallery page, square on the homepage's gallery section
 * - portrait: the 4:5 owner portrait on the About page
 * - avatar:   the round guest photo on a testimonial
 * - wide:     a blog cover (16:9 on the article, 3:2 on the blog list)
 */
export type PreviewLayout =
  | "hero"
  | "banner"
  | "tile"
  | "gallery"
  | "portrait"
  | "avatar"
  | "wide";

const FRAMES: Record<
  PreviewLayout,
  {
    desktop: string;
    mobile: string;
    mobileWidth: string;
    caption: string;
    desktopLabel?: string;
    mobileLabel?: string;
  }
> = {
  hero: { desktop: "aspect-video", mobile: "aspect-[9/16]", mobileWidth: "w-28", caption: "Homepage hero (85% of the screen)" },
  banner: { desktop: "aspect-[5/1]", mobile: "aspect-[3/2]", mobileWidth: "w-40", caption: "Title band at the top of the page" },
  tile: { desktop: "aspect-[4/3]", mobile: "aspect-[4/3]", mobileWidth: "w-36", caption: "Photo tile on the website (4:3)" },
  gallery: {
    desktop: "aspect-[4/3]",
    mobile: "aspect-square",
    mobileWidth: "w-32",
    caption: "Gallery photo",
    desktopLabel: "Gallery page (4:3)",
    mobileLabel: "Homepage (square)",
  },
  portrait: { desktop: "aspect-[4/5]", mobile: "aspect-[4/5]", mobileWidth: "w-28", caption: "Portrait frame (4:5)" },
  wide: {
    desktop: "aspect-video",
    mobile: "aspect-[3/2]",
    mobileWidth: "w-40",
    caption: "Blog cover",
    desktopLabel: "Article (16:9)",
    mobileLabel: "Blog list card (3:2)",
  },
  avatar: { desktop: "aspect-square rounded-full", mobile: "aspect-square rounded-full", mobileWidth: "w-14", caption: "Round guest photo on the review card" },
};

/** What to upload for each place: size, shape and where to keep the subject. */
export type GuideKey = PreviewLayout | "video";

const GUIDES: Record<
  GuideKey,
  { size: string; shape: string; ratio: string; keep: string; file: string }
> = {
  hero: {
    size: "1920 × 1080 px (or larger)",
    shape: "Landscape",
    ratio: "16:9",
    keep: "Keep people, the stage or the gate in the centre. Phones show only the middle third (tall crop), desktops show nearly the full width.",
    file: "JPG, PNG or WebP · up to 40 MB",
  },
  video: {
    size: "1920 × 1080 px",
    shape: "Landscape",
    ratio: "16:9",
    keep: "15–30 seconds, no sound needed. Keep the main action in the centre — phones show only the middle.",
    file: "MP4 or iPhone MOV · up to 50 MB",
  },
  banner: {
    size: "2400 × 1000 px (or larger)",
    shape: "Wide landscape",
    ratio: "about 12:5",
    keep: "Desktops show a thin strip from the middle (~5:1), phones a squarer crop (~3:2). Keep the subject in the very centre; avoid text in the photo.",
    file: "JPG, PNG or WebP · up to 40 MB",
  },
  tile: {
    size: "1600 × 1200 px (or larger)",
    shape: "Landscape",
    ratio: "4:3",
    keep: "Shown the same on desktop and phone. A 4:3 photo is never cropped; other shapes lose their edges.",
    file: "JPG, PNG or WebP · up to 40 MB",
  },
  gallery: {
    size: "1600 × 1200 px (or larger)",
    shape: "Landscape",
    ratio: "4:3",
    keep: "4:3 on the Gallery page, square on the homepage — keep the subject in the centre so both look good.",
    file: "JPG, PNG or WebP · up to 40 MB each",
  },
  portrait: {
    size: "1200 × 1500 px (or larger)",
    shape: "Portrait (upright)",
    ratio: "4:5",
    keep: "Face in the upper half, some space above the head.",
    file: "JPG, PNG or WebP · up to 40 MB",
  },
  wide: {
    size: "1600 × 900 px (or larger)",
    shape: "Landscape",
    ratio: "16:9",
    keep: "16:9 at the top of the article and in WhatsApp/Facebook shares; the blog list shows a 3:2 crop — keep the subject in the centre.",
    file: "JPG, PNG or WebP · up to 40 MB",
  },
  avatar: {
    size: "800 × 800 px",
    shape: "Square",
    ratio: "1:1",
    keep: "Face in the centre; it is shown in a small circle.",
    file: "JPG, PNG or WebP · up to 40 MB",
  },
};

/** Shown above an upload: the best size and shape for this place on the website. */
export function PhotoGuide({ guide, className }: { guide: GuideKey; className?: string }) {
  const g = GUIDES[guide];
  return (
    <div className={cn("rounded-md border border-info/30 bg-info/5 px-3 py-2.5 text-sm", className)}>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
        <Crop className="size-4 text-info" aria-hidden="true" />
        {guide === "video" ? "Best video:" : "Best photo:"}
        <span>{g.size}</span>
        <span className="text-text-muted">·</span>
        <span>
          {g.shape} {g.ratio}
        </span>
      </p>
      <p className="mt-1 text-text-muted">{g.keep}</p>
      <p className="mt-0.5 text-xs text-text-muted">{g.file}. Converted to WebP automatically; only very large photos are resized, without visible loss of quality.</p>
    </div>
  );
}

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
        <figure
          className={cn(
            "min-w-0 flex-1",
            layout === "tile" || layout === "gallery"
              ? "max-w-sm basis-48"
              : layout === "portrait"
                ? "max-w-48 basis-40"
                : layout === "avatar"
                  ? "max-w-24 basis-20"
                  : "basis-64",
          )}
        >
          <figcaption className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <Monitor className="size-3.5" aria-hidden="true" /> {frame.desktopLabel ?? "Desktop"}
          </figcaption>
          <div className="overflow-hidden rounded-md border-4 border-primary-deep bg-primary-deep shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded or local image */}
            <img src={url} alt="" className={cn("w-full object-cover", frame.desktop)} />
          </div>
        </figure>
        <figure className={cn("shrink-0", frame.mobileWidth)}>
          <figcaption className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <Smartphone className="size-3.5" aria-hidden="true" /> {frame.mobileLabel ?? "Mobile"}
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
