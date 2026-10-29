import "server-only";

import { createHash } from "node:crypto";

import { env } from "@/lib/env";
import { signParams } from "@/server/media/cloudinary-sign";

/**
 * Server-side image uploads to Cloudinary (customer photos, ID documents).
 * Every image is stored as WebP: Cloudinary converts it on upload (`format`)
 * and limits its size (`transformation`), even if the browser could not
 * compress it first. Private images use the "authenticated" type, so they can
 * only be opened through a URL signed with our API secret.
 */

export type DeliveryType = "upload" | "authenticated";

export function cloudinaryReady(): boolean {
  const e = env();
  return Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET);
}

export function cloudinaryFolder(name: string): string {
  const prefix = (process.env.CLOUDINARY_FOLDER_PREFIX || "dev").replace(/[^a-z0-9_-]/gi, "");
  return `sundaram/${prefix}/${name}`;
}

/** Uploads one image as WebP, at most `maxSide` px on the long edge. Returns its public ID, or null on failure. */
export async function uploadImage(input: { bytes: Uint8Array; mime: string; folder: string; type: DeliveryType; maxSide: number }): Promise<string | null> {
  if (!cloudinaryReady()) return null;
  const e = env();
  const params = {
    folder: input.folder,
    format: "webp",
    timestamp: Math.floor(Date.now() / 1000),
    transformation: `c_limit,w_${input.maxSide},h_${input.maxSide},q_auto:good`,
    type: input.type,
  };
  const body = new FormData();
  body.set("file", new Blob([new Uint8Array(input.bytes)], { type: input.mime }), "image");
  for (const [key, value] of Object.entries(params)) body.set(key, String(value));
  body.set("api_key", e.CLOUDINARY_API_KEY!);
  body.set("signature", signParams(params, e.CLOUDINARY_API_SECRET!));
  const response = await fetch(`https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  const json = response?.ok ? ((await response.json()) as { public_id?: string }) : null;
  return json?.public_id ?? null;
}

/** Deletes an image (and clears Cloudinary's CDN cache). Failures are reported, never thrown. */
export async function destroyImage(publicId: string, type: DeliveryType): Promise<boolean> {
  if (!cloudinaryReady()) return false;
  const e = env();
  const params = { invalidate: "true", public_id: publicId, timestamp: Math.floor(Date.now() / 1000), type };
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    api_key: e.CLOUDINARY_API_KEY!,
    signature: signParams(params, e.CLOUDINARY_API_SECRET!),
  });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}/image/destroy`, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return Boolean(response?.ok);
}

/** Signed URL for an "authenticated" image; `transform` is optional (e.g. "c_fill,w_320,h_320"). */
export function authenticatedImageUrl(publicId: string, transform?: string): string | null {
  const e = env();
  if (!e.CLOUDINARY_CLOUD_NAME || !e.CLOUDINARY_API_SECRET) return null;
  const path = `${transform ? `${transform}/` : ""}${publicId}.webp`;
  const signature = createHash("sha1")
    .update(path + e.CLOUDINARY_API_SECRET)
    .digest("base64")
    .slice(0, 8)
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `https://res.cloudinary.com/${e.CLOUDINARY_CLOUD_NAME}/image/authenticated/s--${signature}--/${path}`;
}
