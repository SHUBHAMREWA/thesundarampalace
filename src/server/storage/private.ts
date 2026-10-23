import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";

/**
 * Private document store (architecture.md ADR-07). Files live in the
 * `private_blob` table of our own PostgreSQL database: no extra account, no
 * public URL that could leak, and they are included in the nightly encrypted
 * backup. Callers never see a storage URL — downloads go through
 * permission-checked, audit-logged route handlers that stream the bytes.
 *
 * Keys are random UUIDs, never names. Swap this module for R2/S3 later
 * without touching callers.
 */

type Client = Pick<PrismaClient, "privateBlob">;

export type StoredFile = { storageKey: string; sha256: string; sizeBytes: number };

export async function putPrivateFile(bytes: Uint8Array, client: Client = db): Promise<StoredFile> {
  const storageKey = randomUUID();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await client.privateBlob.create({ data: { key: storageKey, data: Buffer.from(bytes) } });
  return { storageKey, sha256, sizeBytes: bytes.byteLength };
}

export async function readPrivateFile(storageKey: string, client: Client = db): Promise<Buffer | null> {
  const row = await client.privateBlob.findUnique({ where: { key: storageKey } });
  return row ? Buffer.from(row.data) : null;
}

/** Removes the bytes (retention end or a valid deletion request); metadata rows stay. */
export async function deletePrivateFile(storageKey: string, client: Client = db): Promise<void> {
  await client.privateBlob.deleteMany({ where: { key: storageKey } });
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
