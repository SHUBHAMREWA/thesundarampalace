/**
 * Browser-side image compression used by every photo upload (owner request,
 * 28 Oct 2026): shrink to `maxSide` on the long edge and re-encode as WebP
 * before anything leaves the device. Drawing to a canvas also drops EXIF data
 * (including GPS location). Non-images (PDF, video) are returned unchanged.
 * The server and Cloudinary still check and convert, so this is an
 * optimisation, not the only safeguard.
 */

export const WEBP_PRESETS = {
  /** Customer photos: small, shown as avatars. */
  avatar: { maxSide: 800, quality: 0.8 },
  /** ID documents: big enough to read the card. */
  document: { maxSide: 2000, quality: 0.82 },
  /**
   * Website images: kept at near-original quality (0.92 looks the same as the
   * original). Only photos bigger than 2560 px — sharper than any screen shows,
   * even a full-width hero on a retina display — are scaled down.
   */
  website: { maxSide: 2560, quality: 0.92 },
} as const;

export type WebpPreset = keyof typeof WEBP_PRESETS;

export function isCompressibleImage(file: File): boolean {
  return /^image\/(jpeg|png|webp|avif|heic|heif|bmp|gif)$/.test(file.type) && file.type !== "image/gif";
}

export async function compressToWebp(file: File, preset: WebpPreset): Promise<File> {
  if (!isCompressibleImage(file)) return file;
  const { maxSide, quality } = WEBP_PRESETS[preset];
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  // Already a WebP of a sensible size: send it untouched (re-encoding only loses quality).
  if (file.type === "image/webp" && scale === 1) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  if (!blob || blob.type !== "image/webp") throw new Error("This browser cannot convert photos to WebP");
  const base = file.name.replace(/\.[^.]*$/, "") || "photo";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}
