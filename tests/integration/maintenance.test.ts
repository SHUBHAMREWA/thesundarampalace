import { afterAll, expect, it } from "vitest";

import { db } from "@/lib/db";
import { runDailyMaintenance } from "@/server/services/maintenance";

import { describeDb } from "./helpers";

describeDb("daily maintenance", () => {
  afterAll(() => db.$disconnect());

  it("prunes only stale technical rows", async () => {
    const now = new Date("2026-11-01T00:30:00Z");
    const user = await db.user.create({ data: { name: "Maint User", email: "maint@example.test" } });
    await db.session.createMany({
      data: [
        { token: "expired", userId: user.id, expiresAt: new Date("2026-10-31T00:00:00Z") },
        { token: "valid", userId: user.id, expiresAt: new Date("2026-11-05T00:00:00Z") },
      ],
    });
    await db.rateLimitBucket.createMany({
      data: [
        { key: "old", windowStart: new Date("2026-10-30T00:00:00Z"), count: 3 },
        { key: "recent", windowStart: new Date("2026-11-01T00:00:00Z"), count: 1 },
      ],
    });

    const result = await runDailyMaintenance(now);

    expect(result.expiredSessions).toBe(1);
    expect(result.rateLimitBuckets).toBe(1);
    expect(await db.session.findUnique({ where: { token: "valid" } })).not.toBeNull();
    expect(await db.rateLimitBucket.count({ where: { key: "recent" } })).toBe(1);
    expect(await db.user.count({ where: { id: user.id } })).toBe(1);
  });
});
