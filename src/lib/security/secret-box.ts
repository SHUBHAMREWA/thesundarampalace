import "server-only";

import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Encrypts API keys that staff type into Settings (AES-256-GCM). The key is
 * derived from BETTER_AUTH_SECRET, so the database alone never reveals them.
 * Rotating BETTER_AUTH_SECRET makes saved keys unreadable: enter them again.
 */
function key(): Buffer {
  return Buffer.from(hkdfSync("sha256", env().BETTER_AUTH_SECRET, "sundaram-settings", "api-credentials", 32));
}

export function sealSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Null when the value is missing or can't be decrypted (e.g. the secret was rotated). */
export function openSecret(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const [version, iv, tag, data] = sealed.split(":");
  if (version !== "v1" || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
