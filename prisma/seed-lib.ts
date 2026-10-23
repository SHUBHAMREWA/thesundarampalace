/**
 * Idempotent reference data shared by the seed script and integration tests:
 * permissions, roles, default lists and settings.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSIONS, ROLES } from "../src/lib/permissions/registry";
import { DEFAULT_LOOKUPS } from "../src/lib/settings/lookups";
import {
  DEFAULT_GALLERY_CATEGORIES,
  DEFAULT_HOME_SECTIONS,
  DEFAULT_SERVICES,
  LEGAL_PAGES,
  STANDARD_PAGES,
} from "../src/lib/content/catalog";
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

/**
 * CMS structure with titles only. Bodies stay empty so the website shows
 * tasteful "coming soon" placeholders until the business supplies content.
 */
export async function seedCms(db: PrismaClient) {
  const pages = [
    ...STANDARD_PAGES.map((p, i) => ({ kind: "STANDARD" as const, slug: p.slug, title: p.title, sortOrder: i * 10 })),
    ...DEFAULT_SERVICES.map((p, i) => ({ kind: "SERVICE" as const, slug: p.slug, title: p.title, sortOrder: i * 10 })),
    ...LEGAL_PAGES.map((p, i) => ({ kind: "LEGAL" as const, slug: p.slug, title: p.title, sortOrder: i * 10 })),
  ];
  for (const page of pages) {
    await db.websitePage.upsert({
      where: { kind_slug: { kind: page.kind, slug: page.slug } },
      update: {},
      create: {
        kind: page.kind,
        slug: page.slug,
        title: { en: page.title },
        published: true,
        publishedAt: new Date(),
        sortOrder: page.sortOrder,
      },
    });
  }
  for (const [index, section] of DEFAULT_HOME_SECTIONS.entries()) {
    await db.homeSection.upsert({
      where: { type: section.type },
      update: {},
      create: {
        type: section.type,
        sortOrder: index * 10,
        visible: section.visible,
        content: { heading: { en: section.heading } },
      },
    });
  }
  for (const [index, category] of DEFAULT_GALLERY_CATEGORIES.entries()) {
    await db.galleryCategory.upsert({
      where: { key: category.key },
      update: {},
      create: { key: category.key, name: { en: category.name }, sortOrder: index * 10 },
    });
  }
}
