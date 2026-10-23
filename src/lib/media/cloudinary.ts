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
  const transforms = ["f_auto", "q_auto", width ? `w_${Math.round(width)}` : null, "c_limit"]
    .filter(Boolean)
    .join(",");
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`;
}

/** Original file URL (videos, PDFs). */
export function cloudinaryFileUrl(publicId: string, resourceType: string, format?: string | null): string {
  const type = resourceType === "video" ? "video" : resourceType === "raw" ? "raw" : "image";
  return `https://res.cloudinary.com/${cloudName}/${type}/upload/${publicId}${format && type !== "raw" ? `.${format}` : ""}`;
}

/** next/image loader for Cloudinary public IDs passed as `src`. */
export function cloudinaryLoader({ src, width }: { src: string; width: number; quality?: number }): string {
  return cloudinaryImageUrl(src, width);
}
