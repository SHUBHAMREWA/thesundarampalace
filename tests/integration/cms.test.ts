import { afterAll, beforeAll, expect, it } from "vitest";

import { db } from "@/lib/db";
import type { PermissionKey } from "@/lib/permissions/registry";
import { ForbiddenError, type Actor } from "@/server/policies/authorize";
import { hallSchema, parseMenuLine, saveHall, saveMenu, menuSchema, savePage, pageSchema, slugify } from "@/server/services/cms";
import { deleteAsset } from "@/server/services/media";
import { consumeRateLimit } from "@/server/services/rate-limit";
import { createStaff, createStaffSchema } from "@/server/services/staff";

import { seedCms, seedLookups, seedSettings, syncAccess } from "../../prisma/seed-lib";
import { describeDb } from "./helpers";

const actor = (permissions: PermissionKey[], id = "cms-actor"): Actor => ({ id, permissions: new Set(permissions) });
const editorAndPublisher = actor(["cms.edit", "cms.publish"]);
const editorOnly = actor(["cms.edit"]);

const hallInput = (overrides: Record<string, unknown> = {}) =>
  hallSchema.parse({
    name: { en: "Sample Hall A", hi: "" },
    slug: "sample-hall-a",
    description: { en: "A lawn for weddings.", hi: "" },
    imageIds: [],
    published: true,
    sortOrder: "0",
    ...overrides,
  });

describeDb("website CMS (test #23)", () => {
  beforeAll(async () => {
    await syncAccess(db);
    await seedLookups(db);
    await seedSettings(db);
    await seedCms(db);
  });

  afterAll(() => db.$disconnect());

  it("saves a venue with its title and description", async () => {
    const id = await saveHall(editorAndPublisher, null, hallInput());
    const hall = await db.hall.findUniqueOrThrow({ where: { id } });
    expect(hall.description).toEqual({ en: "A lawn for weddings." });
  });

  it("rejects duplicate addresses", async () => {
    await expect(saveHall(editorAndPublisher, null, hallInput())).rejects.toThrow(/already uses this address/);
  });

  it("needs cms.publish to change what is public", async () => {
    await expect(saveHall(editorOnly, null, hallInput({ slug: "draft-hall", published: true }))).rejects.toBeInstanceOf(ForbiddenError);
    const id = await saveHall(editorOnly, null, hallInput({ slug: "draft-hall", published: false }));
    expect((await db.hall.findUniqueOrThrow({ where: { id } })).published).toBe(false);
  });

  it("saves pages in both languages with Hindi falling back to English", async () => {
    const page = await db.websitePage.findFirstOrThrow({ where: { kind: "STANDARD", slug: "about" } });
    await savePage(
      editorAndPublisher,
      page.id,
      pageSchema.parse({
        title: { en: "About us", hi: "हमारे बारे में" },
        summary: { en: "Family-run", hi: "" },
        body: { en: "## Our story\n\nText.", hi: "" },
        heroAssetId: "",
        seo: { title: { en: "", hi: "" }, description: { en: "", hi: "" } },
        published: true,
        sortOrder: "10",
      }),
    );
    const saved = await db.websitePage.findUniqueOrThrow({ where: { id: page.id } });
    expect(saved.title).toEqual({ en: "About us", hi: "हमारे बारे में" });
    expect(saved.summary).toEqual({ en: "Family-run" });
    expect(saved.body).toEqual({ en: "## Our story\n\nText." });
  });

  it("parses menu lines and keeps Hindi aligned by position", async () => {
    expect(parseMenuLine("Paneer tikka — smoky, from the tandoor")).toEqual({ name: "Paneer tikka", description: "smoky, from the tandoor" });
    const id = await saveMenu(
      editorAndPublisher,
      null,
      menuSchema.parse({
        name: { en: "Sample Veg Menu", hi: "" },
        category: "veg",
        description: { en: "", hi: "" },
        publicVisible: true,
        sortOrder: "0",
        courses: { starters: { en: "Item A — crisp\nItem B", hi: "आइटम A\n" } },
      }),
    );
    const items = await db.menuItem.findMany({ where: { menuId: id }, orderBy: { sortOrder: "asc" } });
    expect(items.map((i) => i.name)).toEqual([{ en: "Item A", hi: "आइटम A" }, { en: "Item B" }]);
  });

  it("refuses to delete media that is still used on the website", async () => {
    const asset = await db.mediaAsset.create({
      data: { publicId: "sundaram/test/used", resourceType: "image", kind: "IMAGE", alt: { en: "Test image" }, group: "halls" },
    });
    const hall = await db.hall.findUniqueOrThrow({ where: { slug: "sample-hall-a" } });
    await db.mediaPlacement.create({ data: { ownerType: "hall", ownerId: hall.id, assetId: asset.id } });
    await expect(deleteAsset(editorAndPublisher, asset.id)).rejects.toThrow(/still used/);
    await db.mediaPlacement.deleteMany({ where: { assetId: asset.id } });
    await deleteAsset(editorAndPublisher, asset.id);
    expect(await db.mediaAsset.count({ where: { id: asset.id } })).toBe(0);
  });

  it("makes URL slugs", () => {
    expect(slugify("Grand Darbār Hall & Lawn")).toBe("grand-darbar-hall-lawn");
  });
});

describeDb("staff accounts and rate limits", () => {
  afterAll(() => db.$disconnect());

  it("lets Admins create staff but only Super Admins grant privileged roles", async () => {
    await syncAccess(db);
    const admin = actor(["users.manage"], "admin-actor");
    const superAdmin = actor(["users.manage", "roles.manage"], "super-actor");
    const input = (email: string, roleKey: string) =>
      createStaffSchema.parse({ name: "New Staff", email, roleKey, temporaryPassword: "Temporary-Pass-123" });

    const sales = await createStaff(admin, input("new-sales@example.test", "sales"));
    expect(await db.account.count({ where: { userId: sales.id, providerId: "credential" } })).toBe(1);
    await expect(createStaff(admin, input("new-admin@example.test", "admin"))).rejects.toBeInstanceOf(ForbiddenError);
    await createStaff(superAdmin, input("new-admin@example.test", "admin"));
    await expect(createStaff(superAdmin, input("new-sales@example.test", "sales"))).rejects.toThrow(/already exists/);
    expect(await db.auditLog.count({ where: { action: "user.created" } })).toBeGreaterThanOrEqual(2);
  });

  it("blocks requests over the limit within a window", async () => {
    const now = new Date("2026-11-01T10:00:00Z");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeRateLimit("test:key", 3, 600, now));
    expect(results).toEqual([true, true, true, false]);
    expect(await consumeRateLimit("test:key", 3, 600, new Date("2026-11-01T10:10:00Z"))).toBe(true);
  });
});
