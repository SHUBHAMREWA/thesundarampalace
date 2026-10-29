"use client";

import { compressToWebp } from "@/lib/media/to-webp";
import { getUploadSignatureAction } from "@/server/actions/cms";

const MAX_MB = { image: 10, video: 50, application: 15 } as const;

/** Size check shared by every upload; returns an error message or null. */
export function sizeError(file: File): string | null {
  const kind = file.type.split("/")[0] as keyof typeof MAX_MB;
  const limit = MAX_MB[kind] ?? 10;
  return file.size > limit * 1024 * 1024
    ? `Files of this type can be up to ${limit} MB`
    : null;
}

/** Photos are shrunk and converted to WebP in the browser, then sent to Cloudinary with a short-lived signature. */
export async function sendToCloudinary(
  file: File,
  group: string,
): Promise<unknown> {
  const ready = await compressToWebp(file, "website");
  const signed = await getUploadSignatureAction(
    group,
    file.type.startsWith("video/") ? "video" : "other",
  );
  const upload = new FormData();
  upload.set("file", ready);
  upload.set("api_key", signed.apiKey);
  for (const [key, value] of Object.entries(signed.params))
    upload.set(key, value);
  upload.set("signature", signed.signature);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`,
    { method: "POST", body: upload },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message ?? "Upload failed");
  return result;
}
