import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Cloudinary signed uploads (MASTER_PROMPT §23): the browser uploads straight
 * to Cloudinary with a short-lived signature from our server, then we verify
 * Cloudinary's response signature before registering the asset.
 */

/** "mov" is what iPhones record; the website always plays it back as MP4. */
export const ALLOWED_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
  "mp4",
  "webm",
  "mov",
  "pdf",
] as const;

/** Cloudinary's SHA-1 signature over alphabetically sorted params + secret. */
export function signParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const toSign = Object.keys(params)
    .filter((key) => params[key] !== "" && params[key] !== undefined)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1")
    .update(toSign + apiSecret)
    .digest("hex");
}

/** Signed upload params; `eager` (video only) asks Cloudinary to build those sizes in the background. */
export function buildUploadSignature(
  options: { folder: string; timestamp: number; eager?: string },
  apiSecret: string,
): { params: Record<string, string>; signature: string } {
  const params: Record<string, string> = {
    allowed_formats: ALLOWED_FORMATS.join(","),
    folder: options.folder,
    timestamp: String(options.timestamp),
    ...(options.eager ? { eager: options.eager, eager_async: "true" } : {}),
  };
  return { params, signature: signParams(params, apiSecret) };
}

/** Verifies the `signature` Cloudinary returns with an upload response. */
export function verifyUploadResponse(
  response: { public_id: string; version: number | string; signature: string },
  apiSecret: string,
): boolean {
  const expected = createHash("sha1")
    .update(
      `public_id=${response.public_id}&version=${response.version}${apiSecret}`,
    )
    .digest("hex");
  const given = Buffer.from(String(response.signature));
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}
