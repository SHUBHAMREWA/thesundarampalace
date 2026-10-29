import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  authenticatedImageUrl,
  cloudinaryFolder,
  cloudinaryReady,
  destroyImage,
  uploadImage,
} from "@/server/media/cloudinary-images";

/**
 * Private document store (architecture.md ADR-07). Callers never see a
 * storage URL — downloads go through permission-checked, audit-logged route
 * handlers that stream the bytes.
 *
 * - Photos (ID cards, customer photos) go to Cloudinary as private
 *   "authenticated" WebP images (owner request, 28 Oct 2026). Their key is
 *   `cloudinary:<public id>`; the server fetches them with a signed URL and
 *   streams them, so the Cloudinary address never reaches the browser.
 * - PDFs, and photos while Cloudinary is not configured, live in the
 *   `private_blob` table of our own PostgreSQL database.
 *
 * Keys are random, never names.
 */

type Client = Pick<PrismaClient, "privateBlob">;

export type StoredFile = {
  storageKey: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
};

const CLOUDINARY_PREFIX = "cloudinary:";
const IMAGE_MIME = /^image\/(jpeg|png|webp)$/;

/**
 * Stores the bytes. Images are uploaded to Cloudinary when it is configured,
 * so do not call this inside a database transaction for images.
 */
export async function putPrivateFile(
  bytes: Uint8Array,
  mime: string,
  client: Client = db,
  image: { folder: string; maxSide: number } = {
    folder: "private",
    maxSide: 2000,
  },
): Promise<StoredFile> {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (IMAGE_MIME.test(mime) && cloudinaryReady()) {
    const publicId = await uploadImage({
      bytes,
      mime,
      folder: cloudinaryFolder(image.folder),
      type: "authenticated",
      maxSide: image.maxSide,
    });
    if (!publicId)
      throw new Error(
        "The photo could not be uploaded to Cloudinary. Please try again.",
      );
    return {
      storageKey: `${CLOUDINARY_PREFIX}${publicId}`,
      sha256,
      sizeBytes: bytes.byteLength,
      mimeType: "image/webp",
    };
  }
  const storageKey = randomUUID();
  await client.privateBlob.create({
    data: { key: storageKey, data: Buffer.from(bytes) },
  });
  return { storageKey, sha256, sizeBytes: bytes.byteLength, mimeType: mime };
}

/** `transform` (Cloudinary photos only) asks for a smaller copy, e.g. a preview thumbnail. */
export async function readPrivateFile(
  storageKey: string,
  client: Client = db,
  transform?: string,
): Promise<Buffer | null> {
  if (storageKey.startsWith(CLOUDINARY_PREFIX)) {
    const url = authenticatedImageUrl(
      storageKey.slice(CLOUDINARY_PREFIX.length),
      transform,
    );
    const response = url
      ? await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          cache: "no-store",
        }).catch(() => null)
      : null;
    return response?.ok ? Buffer.from(await response.arrayBuffer()) : null;
  }
  const row = await client.privateBlob.findUnique({
    where: { key: storageKey },
  });
  return row ? Buffer.from(row.data) : null;
}

/** Removes the bytes (retention end or a valid deletion request); metadata rows stay. */
export async function deletePrivateFile(
  storageKey: string,
  client: Client = db,
): Promise<void> {
  if (storageKey.startsWith(CLOUDINARY_PREFIX)) {
    await destroyImage(
      storageKey.slice(CLOUDINARY_PREFIX.length),
      "authenticated",
    );
    return;
  }
  await client.privateBlob.deleteMany({ where: { key: storageKey } });
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
