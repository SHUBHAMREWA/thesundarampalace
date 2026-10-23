import { createHmac } from "node:crypto";

/** Fake staff accounts created by global-setup.ts (never real people). */
export const E2E_PASSWORD = "E2e-Password-Only-For-Tests-42";
export const E2E_USERS = {
  superAdmin: { email: "e2e-super-admin@example.test", role: "super_admin", name: "E2E Super Admin" },
  sales: { email: "e2e-sales@example.test", role: "sales", name: "E2E Sales" },
  admin: { email: "e2e-admin@example.test", role: "admin", name: "E2E Admin" },
  owner: { email: "e2e-owner@example.test", role: "super_admin", name: "E2E Owner" },
  kitchen: { email: "e2e-kitchen@example.test", role: "kitchen", name: "E2E Kitchen" },
} as const;

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error(`Invalid base32 character: ${char}`);
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) — what authenticator apps compute. */
export function totp(secretBase32: string, now = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const hmac = createHmac("sha1", base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}
