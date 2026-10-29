import "server-only";

import { createHash } from "node:crypto";

import { sniffFileType } from "@/lib/files/sniff";
import { deletePrivateFile, putPrivateFile } from "@/server/storage/private";

import { fieldError } from "./errors";

/**
 * Customer profile photos. The browser shrinks the photo and converts it to
 * WebP before upload; the private store puts it on Cloudinary as a private
 * WebP image (or in the database while Cloudinary is not configured). Photos
 * are shown only through /api/customers/[id]/photo, which checks permission.
 */

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** The photo file from a form, or null when none was chosen. */
export function photoFromForm(form: FormData): File | null {
  const file = form.get("photo");
  return file instanceof File && file.size > 0 ? file : null;
}

/** Stores one photo and returns its private-store key. */
export async function storeCustomerPhoto(file: File): Promise<string> {
  if (file.size > MAX_PHOTO_BYTES) fieldError("photo", "The photo is too large. Choose a smaller one.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffFileType(bytes);
  if (!type || type.mime === "application/pdf") fieldError("photo", "Choose a JPEG, PNG or WebP photo");
  try {
    const stored = await putPrivateFile(bytes, type.mime, undefined, { folder: "customers", maxSide: 800 });
    return stored.storageKey;
  } catch {
    fieldError("photo", "The photo could not be uploaded. Please try again.");
  }
}

/** Deletes a photo from Cloudinary (or the database). */
export function deleteCustomerPhoto(key: string): Promise<void> {
  return deletePrivateFile(key);
}

/** Where the browser loads the photo; the version changes when the photo does, so caches never show the old one. */
export function customerPhotoUrl(customerId: string, key: string): string {
  const version = createHash("sha1").update(key).digest("hex").slice(0, 10);
  return `/api/customers/${customerId}/photo?v=${version}`;
}
