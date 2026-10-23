import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { FACILITY_KEYS, HALL_LAYOUTS, HOME_SECTION_TYPES, MENU_CATEGORIES, MENU_COURSES } from "@/lib/content/catalog";
import { db } from "@/lib/db";
import { localizedOptional, localizedRequired } from "@/lib/i18n/localized";
import { assertPermission, can, ForbiddenError, type Actor } from "@/server/policies/authorize";

import { recordAudit } from "./audit";

/**
 * Website CMS writes. Every function checks `cms.edit`; changing what is
 * public (publish flags, public prices) also needs `cms.publish`.
 * Callers (server actions) refresh the public cache with updateTag("cms").
 */

const json = (v: unknown) => (v === null || v === undefined ? undefined : (v as Prisma.InputJsonValue));
/** Prisma needs DbNull (not null) to clear a Json column. */
function nullableJson(v: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue);
}

function assertPublishChange(actor: Actor, before: boolean | undefined, after: boolean) {
  if ((before ?? false) !== after && !can(actor, "cms.publish")) throw new ForbiddenError("cms.publish");
}

async function audit(actor: Actor, action: string, entityType: string, entityId: string, summary?: Prisma.InputJsonValue) {
  await recordAudit({ actorId: actor.id, action, entityType, entityId, summary });
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "At least 2 characters")
  .max(80)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only");

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const seoSchema = z.object({ title: localizedOptional, description: localizedOptional });
const optionalId = z.string().max(50).optional().transform((v) => (v ? v : null));
const sortOrder = z.coerce.number().int().min(0).max(100_000).default(0);
const httpsUrl = z
  .union([z.literal(""), z.url({ protocol: /^https$/, error: "Use a full https:// link" })])
  .optional()
  .transform((v) => (v ? v : null));

async function assertAssets(ids: (string | null)[]) {
  const wanted = ids.filter((v): v is string => !!v);
  if (!wanted.length) return;
  const found = await db.mediaAsset.count({ where: { id: { in: wanted } } });
  if (found !== new Set(wanted).size) {
    throw new z.ZodError([{ code: "custom", path: ["media"], message: "Choose images from the media library", input: wanted }]);
  }
}

async function replacePlacements(tx: Prisma.TransactionClient, ownerType: string, ownerId: string, assetIds: string[]) {
  await tx.mediaPlacement.deleteMany({ where: { ownerType, ownerId } });
  if (assetIds.length) {
    await tx.mediaPlacement.createMany({
      data: [...new Set(assetIds)].map((assetId, index) => ({ ownerType, ownerId, assetId, sortOrder: index })),
    });
  }
}

// ─── Pages ──────────────────────────────────────────────────────────────────

export const pageSchema = z.object({
  title: localizedRequired,
  summary: localizedOptional,
  body: localizedOptional,
  heroAssetId: optionalId,
  seo: seoSchema,
  published: z.boolean(),
  sortOrder,
});

export async function savePage(actor: Actor, id: string, input: z.infer<typeof pageSchema>) {
  assertPermission(actor, "cms.edit");
  const page = await db.websitePage.findUniqueOrThrow({ where: { id } });
  assertPublishChange(actor, page.published, input.published);
  await assertAssets([input.heroAssetId]);
  await db.websitePage.update({
    where: { id },
    data: {
      title: input.title,
      summary: nullableJson(input.summary),
      body: nullableJson(input.body),
      heroAssetId: input.heroAssetId,
      seo: json({ title: input.seo.title, description: input.seo.description }) ?? {},
      published: input.published,
      publishedAt: input.published && !page.published ? new Date() : page.publishedAt,
      sortOrder: input.sortOrder,
      updatedById: actor.id,
    },
  });
  await audit(actor, "cms.page.saved", "website_page", id, { slug: page.slug, published: input.published });
}

export async function createServicePage(actor: Actor, input: { title: string; slug: string }) {
  assertPermission(actor, "cms.edit");
  const title = localizedRequired.parse({ en: input.title });
  const slug = slugSchema.parse(input.slug || slugify(input.title));
  const exists = await db.websitePage.findUnique({ where: { kind_slug: { kind: "SERVICE", slug } } });
  if (exists) throw new z.ZodError([{ code: "custom", path: ["slug"], message: "A service page with this address already exists", input: slug }]);
  const page = await db.websitePage.create({ data: { kind: "SERVICE", slug, title, published: false } });
  await audit(actor, "cms.page.created", "website_page", page.id, { slug });
  return page;
}

export async function deleteServicePage(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  const page = await db.websitePage.findUniqueOrThrow({ where: { id } });
  if (page.kind !== "SERVICE") throw new ForbiddenError("cms.publish");
  await db.websitePage.delete({ where: { id } });
  await audit(actor, "cms.page.deleted", "website_page", id, { slug: page.slug });
}

// ─── Homepage sections ──────────────────────────────────────────────────────

export const homeSectionSchema = z.object({
  heading: localizedOptional,
  intro: localizedOptional,
  subheading: localizedOptional,
  videoPath: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\/media\/[\w.-]+\.(mp4|webm)$/.test(v), "Use a file in /media/, e.g. /media/hero.mp4")
    .transform((v) => (v ? v : null)),
  posterAssetId: optionalId,
  visible: z.boolean(),
  sortOrder,
});

export async function saveHomeSection(actor: Actor, type: string, input: z.infer<typeof homeSectionSchema>) {
  assertPermission(actor, "cms.edit");
  if (!(HOME_SECTION_TYPES as readonly string[]).includes(type)) throw new Error("Unknown homepage section");
  const section = await db.homeSection.findUniqueOrThrow({ where: { type } });
  assertPublishChange(actor, section.visible, input.visible);
  await assertAssets([input.posterAssetId]);
  const content: Record<string, unknown> = { heading: input.heading, intro: input.intro };
  if (type === "hero") Object.assign(content, { subheading: input.subheading, videoPath: input.videoPath, posterAssetId: input.posterAssetId });
  await db.homeSection.update({
    where: { type },
    data: { content: content as Prisma.InputJsonValue, visible: input.visible, sortOrder: input.sortOrder },
  });
  await audit(actor, "cms.home_section.saved", "home_section", type);
}

// ─── Halls ──────────────────────────────────────────────────────────────────

const capacityValue = z
  .union([z.literal(""), z.coerce.number().int().min(1, "Must be at least 1").max(100_000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const hallSchema = z.object({
  name: localizedRequired,
  slug: slugSchema,
  summary: localizedOptional,
  description: localizedOptional,
  areaSqFt: capacityValue,
  ceilingHeightFt: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{1,3}(\.\d{1,2})?$/.test(v), "Enter feet, e.g. 18 or 18.5")
    .transform((v) => (v ? v : null)),
  capacities: z.array(
    z
      .object({ layout: z.enum(HALL_LAYOUTS), minGuests: capacityValue, maxGuests: capacityValue })
      .refine((c) => !c.minGuests || !c.maxGuests || c.minGuests <= c.maxGuests, "Minimum can't be above maximum"),
  ),
  facilities: z.array(z.object({ key: z.enum(FACILITY_KEYS), note: z.string().trim().max(120).optional() })),
  eventTypeKeys: z.array(z.string().max(50)),
  slotsInfo: localizedOptional,
  heroAssetId: optionalId,
  floorPlanAssetId: optionalId,
  imageIds: z.array(z.string().max(50)),
  tourUrl: httpsUrl,
  seo: seoSchema,
  published: z.boolean(),
  sortOrder,
});
export type HallInput = z.infer<typeof hallSchema>;

export async function saveHall(actor: Actor, id: string | null, input: HallInput): Promise<string> {
  assertPermission(actor, "cms.edit");
  const existing = id ? await db.hall.findUniqueOrThrow({ where: { id } }) : null;
  assertPublishChange(actor, existing?.published, input.published);
  const slugOwner = await db.hall.findUnique({ where: { slug: input.slug } });
  if (slugOwner && slugOwner.id !== id) {
    throw new z.ZodError([{ code: "custom", path: ["slug"], message: "Another venue already uses this address", input: input.slug }]);
  }
  await assertAssets([input.heroAssetId, input.floorPlanAssetId, ...input.imageIds]);
  const data = {
    name: input.name,
    slug: input.slug,
    summary: nullableJson(input.summary),
    description: nullableJson(input.description),
    areaSqFt: input.areaSqFt,
    ceilingHeightFt: input.ceilingHeightFt,
    facilities: input.facilities.map((f) => ({ key: f.key, ...(f.note ? { note: f.note } : {}) })),
    eventTypeKeys: input.eventTypeKeys,
    slotsInfo: nullableJson(input.slotsInfo),
    heroAssetId: input.heroAssetId,
    floorPlanAssetId: input.floorPlanAssetId,
    tourUrl: input.tourUrl,
    seo: json({ title: input.seo.title, description: input.seo.description }) ?? {},
    published: input.published,
    sortOrder: input.sortOrder,
  };
  const hallId = await db.$transaction(async (tx) => {
    const hall = id ? await tx.hall.update({ where: { id }, data }) : await tx.hall.create({ data });
    await tx.hallLayoutCapacity.deleteMany({ where: { hallId: hall.id } });
    const capacities = input.capacities.filter((c) => c.minGuests || c.maxGuests);
    if (capacities.length) {
      await tx.hallLayoutCapacity.createMany({
        data: capacities.map((c) => ({ hallId: hall.id, layout: c.layout, minGuests: c.minGuests, maxGuests: c.maxGuests })),
      });
    }
    await replacePlacements(tx, "hall", hall.id, input.imageIds);
    return hall.id;
  });
  await audit(actor, id ? "cms.hall.saved" : "cms.hall.created", "hall", hallId, { slug: input.slug, published: input.published });
  return hallId;
}

export async function deleteHall(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  const hall = await db.hall.findUniqueOrThrow({ where: { id } });
  await db.$transaction([
    db.mediaPlacement.deleteMany({ where: { ownerType: "hall", ownerId: id } }),
    db.hall.delete({ where: { id } }),
  ]);
  await audit(actor, "cms.hall.deleted", "hall", id, { slug: hall.slug });
}

// ─── Menus ──────────────────────────────────────────────────────────────────

/** "Paneer tikka — smoky, tandoor" → name + description. */
export function parseMenuLine(line: string): { name: string; description?: string } {
  const [name, ...rest] = line.split(/\s+[—–-]\s+/);
  const description = rest.join(" — ").trim();
  return { name: name.trim(), ...(description ? { description } : {}) };
}

export const menuSchema = z.object({
  name: localizedRequired,
  category: z.enum(MENU_CATEGORIES),
  description: localizedOptional,
  publicVisible: z.boolean(),
  sortOrder,
  courses: z.partialRecord(z.enum(MENU_COURSES), z.object({ en: z.string().max(10_000), hi: z.string().max(10_000) })),
});

export async function saveMenu(actor: Actor, id: string | null, input: z.infer<typeof menuSchema>): Promise<string> {
  assertPermission(actor, "cms.edit");
  const existing = id ? await db.menu.findUniqueOrThrow({ where: { id } }) : null;
  assertPublishChange(actor, existing?.publicVisible, input.publicVisible);
  const items: Prisma.MenuItemCreateManyMenuInput[] = [];
  for (const course of MENU_COURSES) {
    const lines = input.courses[course];
    if (!lines) continue;
    const en = lines.en.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const hi = lines.hi.split(/\r?\n/).map((l) => l.trim());
    en.forEach((line, index) => {
      const parsedEn = parseMenuLine(line);
      const parsedHi = hi[index] ? parseMenuLine(hi[index]) : null;
      items.push({
        course,
        sortOrder: index,
        name: { en: parsedEn.name, ...(parsedHi?.name ? { hi: parsedHi.name } : {}) },
        description:
          parsedEn.description || parsedHi?.description
            ? { en: parsedEn.description ?? "", ...(parsedHi?.description ? { hi: parsedHi.description } : {}) }
            : undefined,
      });
    });
  }
  const data = {
    name: input.name,
    category: input.category,
    description: nullableJson(input.description),
    publicVisible: input.publicVisible,
    sortOrder: input.sortOrder,
  };
  const menuId = await db.$transaction(async (tx) => {
    const menu = id ? await tx.menu.update({ where: { id }, data }) : await tx.menu.create({ data });
    // Website menus only; bookings snapshot their own menu copies (Phase 3).
    await tx.menuItem.deleteMany({ where: { menuId: menu.id } });
    if (items.length) await tx.menuItem.createMany({ data: items.map((i) => ({ ...i, menuId: menu.id })) });
    return menu.id;
  });
  await audit(actor, id ? "cms.menu.saved" : "cms.menu.created", "menu", menuId);
  return menuId;
}

export async function deleteMenu(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  await db.menu.delete({ where: { id } });
  await audit(actor, "cms.menu.deleted", "menu", id);
}

// ─── Décor themes ───────────────────────────────────────────────────────────

export const decorSchema = z.object({
  name: localizedRequired,
  slug: slugSchema,
  description: localizedOptional,
  imageIds: z.array(z.string().max(50)),
  published: z.boolean(),
  sortOrder,
});

export async function saveDecorTheme(actor: Actor, id: string | null, input: z.infer<typeof decorSchema>): Promise<string> {
  assertPermission(actor, "cms.edit");
  const existing = id ? await db.decorTheme.findUniqueOrThrow({ where: { id } }) : null;
  assertPublishChange(actor, existing?.published, input.published);
  const owner = await db.decorTheme.findUnique({ where: { slug: input.slug } });
  if (owner && owner.id !== id) throw new z.ZodError([{ code: "custom", path: ["slug"], message: "Another theme uses this address", input: input.slug }]);
  await assertAssets(input.imageIds);
  const data = {
    name: input.name,
    slug: input.slug,
    description: nullableJson(input.description),
    published: input.published,
    sortOrder: input.sortOrder,
  };
  const themeId = await db.$transaction(async (tx) => {
    const theme = id ? await tx.decorTheme.update({ where: { id }, data }) : await tx.decorTheme.create({ data });
    await replacePlacements(tx, "decor_theme", theme.id, input.imageIds);
    return theme.id;
  });
  await audit(actor, id ? "cms.decor.saved" : "cms.decor.created", "decor_theme", themeId);
  return themeId;
}

export async function deleteDecorTheme(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  await db.$transaction([
    db.mediaPlacement.deleteMany({ where: { ownerType: "decor_theme", ownerId: id } }),
    db.decorTheme.delete({ where: { id } }),
  ]);
  await audit(actor, "cms.decor.deleted", "decor_theme", id);
}

// ─── Packages ───────────────────────────────────────────────────────────────

export const packageSchema = z
  .object({
    name: localizedRequired,
    slug: slugSchema,
    description: localizedOptional,
    inclusions: localizedOptional,
    addOns: localizedOptional,
    terms: localizedOptional,
    eventTypeKeys: z.array(z.string().max(50)),
    publicPrice: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^\d{1,10}(\.\d{1,2})?$/.test(v), "Enter rupees, e.g. 150000")
      .transform((v) => (v ? v : null)),
    publicPriceNote: localizedOptional,
    showPublicPrice: z.boolean(),
    published: z.boolean(),
    sortOrder,
  })
  .refine((p) => !p.showPublicPrice || p.publicPrice, { path: ["publicPrice"], message: "Enter the price to show it publicly" });

export async function savePackage(actor: Actor, id: string | null, input: z.infer<typeof packageSchema>): Promise<string> {
  assertPermission(actor, "cms.edit");
  const existing = id ? await db.package.findUniqueOrThrow({ where: { id } }) : null;
  assertPublishChange(actor, existing?.published, input.published);
  assertPublishChange(actor, existing?.showPublicPrice, input.showPublicPrice);
  const owner = await db.package.findUnique({ where: { slug: input.slug } });
  if (owner && owner.id !== id) throw new z.ZodError([{ code: "custom", path: ["slug"], message: "Another package uses this address", input: input.slug }]);
  const data = {
    name: input.name,
    slug: input.slug,
    description: nullableJson(input.description),
    inclusions: nullableJson(input.inclusions),
    addOns: nullableJson(input.addOns),
    terms: nullableJson(input.terms),
    eventTypeKeys: input.eventTypeKeys,
    publicPrice: input.publicPrice,
    publicPriceNote: nullableJson(input.publicPriceNote),
    showPublicPrice: input.showPublicPrice,
    published: input.published,
    sortOrder: input.sortOrder,
  };
  const pkg = id ? await db.package.update({ where: { id }, data }) : await db.package.create({ data });
  await audit(actor, id ? "cms.package.saved" : "cms.package.created", "package", pkg.id, {
    showPublicPrice: input.showPublicPrice,
    publicPrice: input.publicPrice,
  });
  return pkg.id;
}

export async function deletePackage(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  await db.package.delete({ where: { id } });
  await audit(actor, "cms.package.deleted", "package", id);
}

// ─── Gallery and dates ──────────────────────────────────────────────────────

export async function addGalleryItems(actor: Actor, categoryId: string, assetIds: string[]) {
  assertPermission(actor, "cms.publish");
  if (!assetIds.length) throw new z.ZodError([{ code: "custom", path: ["assetIds"], message: "Choose at least one photo", input: assetIds }]);
  await db.galleryCategory.findUniqueOrThrow({ where: { id: categoryId } });
  await assertAssets(assetIds);
  await db.galleryItem.createMany({
    data: assetIds.map((assetId, i) => ({ categoryId, assetId, sortOrder: i })),
    skipDuplicates: true,
  });
  await audit(actor, "cms.gallery.added", "gallery_category", categoryId, { count: assetIds.length });
}

export async function updateGalleryItem(actor: Actor, id: string, input: { featured: boolean; sortOrder: number }) {
  assertPermission(actor, "cms.publish");
  await db.galleryItem.update({ where: { id }, data: { featured: input.featured, sortOrder: input.sortOrder } });
}

export async function removeGalleryItem(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  await db.galleryItem.delete({ where: { id } });
  await audit(actor, "cms.gallery.removed", "gallery_item", id);
}

export const dateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  label: localizedRequired,
  note: localizedOptional,
});

export async function addAuspiciousDate(actor: Actor, input: z.infer<typeof dateSchema>) {
  assertPermission(actor, "cms.publish");
  const row = await db.auspiciousDate.create({
    data: { date: new Date(`${input.date}T00:00:00Z`), label: input.label, note: nullableJson(input.note) },
  });
  await audit(actor, "cms.date.added", "auspicious_date", row.id, { date: input.date });
}

export async function deleteAuspiciousDate(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  await db.auspiciousDate.delete({ where: { id } });
  await audit(actor, "cms.date.deleted", "auspicious_date", id);
}
