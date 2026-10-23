import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Client = Pick<PrismaClient, "rateLimitBucket" | "session" | "verification">;

export type DailyMaintenanceResult = {
  rateLimitBuckets: number;
  expiredSessions: number;
  expiredVerifications: number;
};

/**
 * Daily housekeeping (scheduled by GitHub Actions → /api/cron/daily).
 * Deletes only short-lived technical rows, never business or audit data.
 */
export async function runDailyMaintenance(
  now: Date = new Date(),
  client: Client = db,
): Promise<DailyMaintenanceResult> {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [rateLimitBuckets, expiredSessions, expiredVerifications] = await Promise.all([
    client.rateLimitBucket.deleteMany({ where: { windowStart: { lt: dayAgo } } }),
    client.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    client.verification.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
  return {
    rateLimitBuckets: rateLimitBuckets.count,
    expiredSessions: expiredSessions.count,
    expiredVerifications: expiredVerifications.count,
  };
}
