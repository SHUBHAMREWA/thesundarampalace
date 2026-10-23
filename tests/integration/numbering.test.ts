import { afterAll, expect, it } from "vitest";

import { db } from "@/lib/db";
import { allocateNumber, nextLeadReference } from "@/server/services/numbering";

import { describeDb } from "./helpers";

describeDb("number sequences", () => {
  afterAll(() => db.$disconnect());

  it("formats lead references per IST calendar year", async () => {
    const ref = await nextLeadReference(db, new Date("2026-06-01T06:00:00Z"));
    expect(ref).toMatch(/^SP-L-2026-\d{5}$/);
  });

  it("allocates gap-free unique numbers under concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, () =>
        db.$transaction((tx) => allocateNumber(tx, "concurrency-test", "2026-27", "INV")),
      ),
    );
    const values = results.map((r) => r.value).sort((a, b) => a - b);
    expect(values).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it("does not consume a number when the transaction rolls back", async () => {
    await expect(
      db.$transaction(async (tx) => {
        await allocateNumber(tx, "rollback-test", "2026-27", "INV");
        throw new Error("document insert failed");
      }),
    ).rejects.toThrow("document insert failed");
    const next = await db.$transaction((tx) => allocateNumber(tx, "rollback-test", "2026-27", "INV"));
    expect(next.value).toBe(1);
  });

  it("keeps separate sequences per period", async () => {
    const a = await allocateNumber(db, "fy-test", "2026-27", "INV");
    const b = await allocateNumber(db, "fy-test", "2027-28", "INV");
    expect([a.value, b.value]).toEqual([1, 1]);
  });
});
