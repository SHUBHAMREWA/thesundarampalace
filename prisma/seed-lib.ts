/**
 * Idempotent reference data shared by the seed script and integration tests:
 * permissions, roles, default lists and settings.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSIONS, ROLES } from "../src/lib/permissions/registry";
import { DEFAULT_LOOKUPS } from "../src/lib/settings/lookups";
import { DEFAULT_SETTINGS } from "../src/lib/settings/schemas";

export async function syncAccess(db: PrismaClient) {
  for (const [key, description] of Object.entries(PERMISSIONS)) {
    await db.permission.upsert({ where: { key }, update: { description }, create: { key, description } });
  }
  for (const role of ROLES) {
    const saved = await db.role.upsert({
      where: { key: role.key },
      update: { name: role.name, requires2fa: role.requires2fa },
      create: { key: role.key, name: role.name, requires2fa: role.requires2fa, system: true },
    });
    // Only system defaults are synced; roles edited in the CRM later keep their changes.
    const existing = await db.rolePermission.count({ where: { roleId: saved.id } });
    if (existing === 0) {
      await db.rolePermission.createMany({
        data: role.permissions.map((permissionKey) => ({ roleId: saved.id, permissionKey })),
        skipDuplicates: true,
      });
    }
  }
}

export async function seedLookups(db: PrismaClient) {
  for (const [listKey, values] of Object.entries(DEFAULT_LOOKUPS)) {
    for (const [index, value] of values.entries()) {
      await db.lookupValue.upsert({
        where: { listKey_key: { listKey, key: value.key } },
        update: {},
        create: {
          listKey,
          key: value.key,
          label: { en: value.label },
          sortOrder: index * 10,
          systemKey: value.systemKey ?? null,
        },
      });
    }
  }
}

export async function seedSettings(db: PrismaClient) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}
