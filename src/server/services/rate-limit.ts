import "server-only";

import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Fixed-window rate limiting in PostgreSQL (docs/architecture.md ADR-12).
 * Keys are hashed, so raw IPs and phone numbers are never stored.
 */
export function rateLimitKey(scope: string, value: string): string {
  const digest = createHash("sha256").update(`${env().BETTER_AUTH_SECRET}:${scope}:${value}`).digest("hex");
  return `${scope}:${digest.slice(0, 40)}`;
}

/** Counts this request; returns false when the limit for the window is exceeded. */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now: Date = new Date(),
): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit_bucket" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "rate_limit_bucket"."count" + 1
    RETURNING "count"
  `;
  return (rows[0]?.count ?? 0) <= limit;
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
