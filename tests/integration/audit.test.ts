import { afterAll, expect, it } from "vitest";

import { db } from "@/lib/db";
import { recordAudit } from "@/server/services/audit";

import { describeDb } from "./helpers";

describeDb("audit log", () => {
  afterAll(() => db.$disconnect());

  it("records entries", async () => {
    await recordAudit({ action: "test.created", entityType: "test", entityId: "t-1", summary: { ok: true } });
    const row = await db.auditLog.findFirst({ where: { entityId: "t-1" } });
    expect(row?.action).toBe("test.created");
  });

  it("is append-only at the database level", async () => {
    await recordAudit({ action: "test.locked", entityType: "test", entityId: "t-2" });
    const row = await db.auditLog.findFirstOrThrow({ where: { entityId: "t-2" } });
    await expect(
      db.auditLog.update({ where: { id: row.id }, data: { action: "tampered" } }),
    ).rejects.toThrow(/append-only/);
    await expect(db.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
  });
});
