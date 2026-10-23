import { afterAll, beforeAll, expect, it } from "vitest";

import { db } from "@/lib/db";
import { ALL_PERMISSIONS, ROLES, type RoleKey } from "@/lib/permissions/registry";
import {
  assertPermission,
  ForbiddenError,
  loadUserAccess,
  UnauthenticatedError,
} from "@/server/policies/authorize";

import { seedLookups, seedSettings, syncAccess } from "../../prisma/seed-lib";
import { describeDb } from "./helpers";

const userIds = new Map<RoleKey, string>();

describeDb("permission matrix (test #18)", () => {
  beforeAll(async () => {
    await syncAccess(db);
    await seedLookups(db);
    await seedSettings(db);
    for (const role of ROLES) {
      const user = await db.user.create({
        data: { name: `Test ${role.name}`, email: `${role.key}@example.test` },
      });
      const saved = await db.role.findUniqueOrThrow({ where: { key: role.key } });
      await db.userRole.create({ data: { userId: user.id, roleId: saved.id } });
      userIds.set(role.key, user.id);
    }
  });

  afterAll(() => db.$disconnect());

  it("rejects anonymous callers", () => {
    expect(() => assertPermission(null, "leads.read")).toThrow(UnauthenticatedError);
  });

  for (const role of ROLES) {
    it(`${role.name}: allowed exactly its permissions, forbidden everything else`, async () => {
      const access = await loadUserAccess(userIds.get(role.key)!);
      const actor = { id: userIds.get(role.key)!, permissions: access.permissions };
      expect(access.requires2fa).toBe(role.requires2fa);
      for (const permission of ALL_PERMISSIONS) {
        if (role.permissions.includes(permission)) {
          expect(() => assertPermission(actor, permission)).not.toThrow();
        } else {
          expect(() => assertPermission(actor, permission), `${role.key} → ${permission}`).toThrow(
            ForbiddenError,
          );
        }
      }
    });
  }

  it("keeps sensitive areas restricted", async () => {
    const sales = await loadUserAccess(userIds.get("sales")!);
    const kitchen = await loadUserAccess(userIds.get("kitchen")!);
    const operations = await loadUserAccess(userIds.get("operations")!);
    expect(sales.permissions.has("payments.read")).toBe(false);
    expect(sales.permissions.has("documents.sensitive.read")).toBe(false);
    expect(operations.permissions.has("payments.read")).toBe(false);
    expect([...kitchen.permissions].sort()).toEqual(["kitchen.read", "pdf.kitchen_sheet"]);
  });

  it("seeds the default lists with system keys", async () => {
    const statuses = await db.lookupValue.findMany({ where: { listKey: "lead_status" } });
    expect(statuses.map((s) => s.systemKey).filter(Boolean).sort()).toEqual(["LOST", "NEW", "WON"]);
  });
});
