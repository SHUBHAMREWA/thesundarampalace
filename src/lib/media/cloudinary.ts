/**
 * Cloudinary delivery URLs (safe on client and server). Signing helpers that
 * need the API secret live in src/server/media/cloudinary-sign.ts.
 */

export const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

export type MediaRef = {
  publicId: string;
  resourceType: string;
  width: number | null;
  height: number | null;
  alt: string;
};

/** Optimised image URL: automatic format (AVIF/WebP) and quality; metadata stripped. */
export function cloudinaryImageUrl(publicId: string, width?: number): string {
  const transforms = [
    "f_auto",
    "q_auto",
    width ? `w_${Math.round(width)}` : null,
    "c_limit",
  ]
    .filter(Boolean)
    .join(",");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`;
}

const videoTransform = (width: number) =>
  `q_auto,vc_h264,ac_none,w_${Math.round(width)},c_limit`;
const posterTransform = (width: number) =>
  `so_1,q_auto,w_${Math.round(width)},c_limit`;

/** Sizes the homepage asks for (src/app/(website)/[locale]/page.tsx). */
export const HERO_VIDEO_WIDTHS = [1920, 720] as const;
export const HERO_POSTER_WIDTHS = [1600, 1280] as const;

/**
 * Cloudinary `eager` list that builds every hero size right after upload.
 * Without it Cloudinary converts on the first visit, which it refuses for
 * large videos (over ~40 MB on the free plan), so the film would not play.
 * Must stay in step with the URLs below.
 */
export const HERO_VIDEO_EAGER = [
  ...HERO_VIDEO_WIDTHS.map((w) => `${videoTransform(w)}/mp4`),
  ...HERO_POSTER_WIDTHS.map((w) => `${posterTransform(w)}/jpg`),
].join("|");

/**
 * Optimised MP4 for the hero film: automatic quality, H.264 (plays everywhere,
 * also for uploaded .mov/.webm files), no sound track, at most `width` px wide.
 */
export function cloudinaryVideoUrl(publicId: string, width: number): string {
  return `https://res.cloudinary.com/${cloudName}/video/upload/${videoTransform(width)}/${publicId}.mp4`;
}

/** A still frame (1 second in) of a Cloudinary video, used as its poster. */
export function cloudinaryVideoPoster(publicId: string, width: number): string {
  return `https://res.cloudinary.com/${cloudName}/video/upload/${posterTransform(width)}/${publicId}.jpg`;
}

/** next/image loader for Cloudinary public IDs passed as `src`. */
export function cloudinaryLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  return cloudinaryImageUrl(src, width);
}
