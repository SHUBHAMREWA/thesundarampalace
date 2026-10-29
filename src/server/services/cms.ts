import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  HOME_SECTION_TYPES,
  MENU_CATEGORIES,
  MENU_COURSES,
} from "@/lib/content/catalog";
import { db } from "@/lib/db";
import { localizedOptional, localizedRequired } from "@/lib/i18n/localized";
import {
  assertPermission,
  can,
  ForbiddenError,
  type Actor,
} from "@/server/policies/authorize";

import { recordAudit } from "./audit";
import { RuleError } from "./errors";
import { assetUsage, deleteAsset } from "./media";

/**
 * Website CMS writes. Every function checks `cms.edit`; changing what is
 * public (publish flags, public prices) also needs `cms.publish`.
 * Callers (server actions) refresh the public cache with updateTag("cms").
 */

const json = (v: unknown) =>
  v === null || v === undefined ? undefined : (v as Prisma.InputJsonValue);
/** Prisma needs DbNull (not null) to clear a Json column. */
function nullableJson(
  v: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return v === null || v === undefined
    ? Prisma.DbNull
    : (v as Prisma.InputJsonValue);
}

function assertPublishChange(
  actor: Actor,
  before: boolean | undefined,
  after: boolean,
) {
  if ((before ?? false) !== after && !can(actor, "cms.publish"))
    throw new ForbiddenError("cms.publish");
}

async function audit(
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  summary?: Prisma.InputJsonValue,
) {
  await recordAudit({
    actorId: actor.id,
    action,
    entityType,
    entityId,
    summary,
  });
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "At least 2 characters")
  .max(80)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and hyphens only",
  );

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const seoSchema = z.object({
  title: localizedOptional,
  description: localizedOptional,
});
const optionalId = z
  .string()
  .max(50)
  .optional()
  .transform((v) => (v ? v : null));
const sortOrder = z.coerce.number().int().min(0).max(100_000).default(0);

async function assertAssets(ids: (string | null)[]) {
  const wanted = ids.filter((v): v is string => !!v);
  if (!wanted.length) return;
  const found = await db.mediaAsset.count({ where: { id: { in: wanted } } });
  if (found !== new Set(wanted).size) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["media"],
        message: "Choose images from the media library",
        input: wanted,
      },
    ]);
  }
}

async function assertAssetKind(
  ids: (string | null)[],
  kind: "IMAGE" | "VIDEO",
) {
  const wanted = [...new Set(ids.filter((v): v is string => !!v))];
  if (!wanted.length) return;
  const found = await db.mediaAsset.count({
    where: { id: { in: wanted }, kind },
  });
  if (found !== wanted.length) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["media"],
        message:
          kind === "VIDEO"
            ? "Choose a video from the media library"
            : "Choose images from the media library",
        input: wanted,
      },
    ]);
  }
}

async function replacePlacements(
  tx: Prisma.TransactionClient,
  ownerType: string,
  ownerId: string,
  assetIds: string[],
) {
  await tx.mediaPlacement.deleteMany({ where: { ownerType, ownerId } });
  if (assetIds.length) {
    await tx.mediaPlacement.createMany({
      data: [...new Set(assetIds)].map((assetId, index) => ({
        ownerType,
        ownerId,
        assetId,
        sortOrder: index,
      })),
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
  /** Celebrations (SERVICE pages) and the standard pages in PAGES_WITH_PHOTOS: their photo gallery. */
  imageIds: z.array(z.string().max(50)).default([]),
  published: z.boolean(),
  sortOrder,
});

/** Standard pages that show a photo gallery (stored as "service_page" placements, keyed by the page id). */
export const PAGES_WITH_PHOTOS = ["catering"];

/** Celebration pages are just a title, a description and photos (owner request, 28 Oct 2026). */
async function saveServicePage(
  actor: Actor,
  page: {
    id: string;
    slug: string;
    published: boolean;
    publishedAt: Date | null;
  },
  input: z.infer<typeof pageSchema>,
) {
  await assertAssetKind(input.imageIds, "IMAGE");
  await db.$transaction(async (tx) => {
    await tx.websitePage.update({
      where: { id: page.id },
      data: {
        title: input.title,
        body: nullableJson(input.body),
        published: input.published,
        publishedAt:
          input.published && !page.published ? new Date() : page.publishedAt,
        sortOrder: input.sortOrder,
        updatedById: actor.id,
      },
    });
    await replacePlacements(tx, "service_page", page.id, input.imageIds);
  });
  await audit(actor, "cms.page.saved", "website_page", page.id, {
    slug: page.slug,
    published: input.published,
  });
}

export async function savePage(
  actor: Actor,
  id: string,
  input: z.infer<typeof pageSchema>,
) {
  assertPermission(actor, "cms.edit");
  const page = await db.websitePage.findUniqueOrThrow({ where: { id } });
  assertPublishChange(actor, page.published, input.published);
  if (page.kind === "SERVICE") return saveServicePage(actor, page, input);
  await assertAssets([input.heroAssetId]);
  const photos = PAGES_WITH_PHOTOS.includes(page.slug);
  if (photos) await assertAssetKind(input.imageIds, "IMAGE");
  await db.$transaction(async (tx) => {
    await tx.websitePage.update({
      where: { id },
      data: {
        title: input.title,
        summary: nullableJson(input.summary),
        body: nullableJson(input.body),
        heroAssetId: input.heroAssetId,
        seo:
          json({
            title: input.seo.title,
            description: input.seo.description,
          }) ?? {},
        published: input.published,
        publishedAt:
          input.published && !page.published ? new Date() : page.publishedAt,
        sortOrder: input.sortOrder,
        updatedById: actor.id,
      },
    });
    if (photos) await replacePlacements(tx, "service_page", id, input.imageIds);
  });
  await audit(actor, "cms.page.saved", "website_page", id, {
    slug: page.slug,
    published: input.published,
  });
}

export async function createServicePage(
  actor: Actor,
  input: { title: string; slug: string },
) {
  assertPermission(actor, "cms.edit");
  const title = localizedRequired.parse({ en: input.title });
  const slug = slugSchema.parse(input.slug || slugify(input.title));
  const exists = await db.websitePage.findUnique({
    where: { kind_slug: { kind: "SERVICE", slug } },
  });
  if (exists)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["slug"],
        message: "A service page with this address already exists",
        input: slug,
      },
    ]);
  const page = await db.websitePage.create({
    data: { kind: "SERVICE", slug, title, published: false },
  });
  await audit(actor, "cms.page.created", "website_page", page.id, { slug });
  return page;
}

export async function deleteServicePage(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  const page = await db.websitePage.findUniqueOrThrow({ where: { id } });
  if (page.kind !== "SERVICE") throw new ForbiddenError("cms.publish");
  await db.$transaction([
    db.mediaPlacement.deleteMany({
      where: { ownerType: "service_page", ownerId: id },
    }),
    db.websitePage.delete({ where: { id } }),
  ]);
  await audit(actor, "cms.page.deleted", "website_page", id, {
    slug: page.slug,
  });
}

// ─── Homepage sections ──────────────────────────────────────────────────────

/** Homepage sections that can carry a left/right picture carousel. */
export const PICTURE_SECTIONS = ["venues", "services", "catering"] as const;

const assetIds = z.array(z.string().min(1).max(50)).max(20).default([]);

export const homeSectionSchema = z.object({
  heading: localizedOptional,
  intro: localizedOptional,
  subheading: localizedOptional,
  /** Hero: an image slideshow or one video. */
  heroMedia: z.enum(["images", "video"]).default("images"),
  slideAssetIds: assetIds,
  videoAssetId: optionalId,
  pictureAssetIds: assetIds,
  videoPath: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || /^\/media\/[\w.-]+\.(mp4|webm)$/.test(v),
      "Use a file in /media/, e.g. /media/hero.mp4",
    )
    .transform((v) => (v ? v : null)),
  posterAssetId: optionalId,
  visible: z.boolean(),
});

export async function saveHomeSection(
  actor: Actor,
  type: string,
  input: z.infer<typeof homeSectionSchema>,
) {
  assertPermission(actor, "cms.edit");
  if (!(HOME_SECTION_TYPES as readonly string[]).includes(type))
    throw new Error("Unknown homepage section");
  const section = await db.homeSection.findUniqueOrThrow({ where: { type } });
  assertPublishChange(actor, section.visible, input.visible);
  const content: Record<string, unknown> = {
    heading: input.heading,
    intro: input.intro,
  };
  if (type === "hero") {
    await assertAssetKind(
      [input.posterAssetId, ...input.slideAssetIds],
      "IMAGE",
    );
    await assertAssetKind([input.videoAssetId], "VIDEO");
    if (input.heroMedia === "images" && !input.slideAssetIds.length) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["slideAssetIds"],
          message: "Choose at least one image for the slideshow",
          input: null,
        },
      ]);
    }
    if (
      input.heroMedia === "video" &&
      !input.videoAssetId &&
      !input.videoPath
    ) {
      throw new z.ZodError([
        {
          code: "custom",
          path: ["videoAssetId"],
          message: "Choose a video",
          input: null,
        },
      ]);
    }
    Object.assign(content, {
      subheading: input.subheading,
      heroMedia: input.heroMedia,
      slideAssetIds: input.slideAssetIds,
      videoAssetId: input.videoAssetId,
      videoPath: input.videoPath,
      posterAssetId: input.posterAssetId,
    });
  }
  if ((PICTURE_SECTIONS as readonly string[]).includes(type)) {
    await assertAssetKind(input.pictureAssetIds, "IMAGE");
    content.pictureAssetIds = input.pictureAssetIds;
  }
  await db.homeSection.update({
    where: { type },
    data: {
      content: content as Prisma.InputJsonValue,
      visible: input.visible,
    },
  });
  await audit(actor, "cms.home_section.saved", "home_section", type);
  // Files taken off the hero (replaced or removed video, poster, slides) are deleted when nothing else uses them.
  if (type === "hero") {
    const old = section.content as {
      videoAssetId?: string | null;
      posterAssetId?: string | null;
      slideAssetIds?: string[];
    };
    const kept = new Set<string | null>(
      [input.videoAssetId, input.posterAssetId, ...input.slideAssetIds].filter(
        Boolean,
      ),
    );
    const dropped = [
      old.videoAssetId,
      old.posterAssetId,
      ...(old.slideAssetIds ?? []),
    ].filter((id): id is string => !!id && !kept.has(id));
    await dropUnusedPhotos(actor, dropped);
  }
}

/**
 * Moves a homepage section one place up or down. The hero always stays first.
 * Positions are renumbered 10, 20, 30… so they stay tidy.
 */
export async function moveHomeSection(
  actor: Actor,
  type: string,
  direction: "up" | "down",
) {
  assertPermission(actor, "cms.edit");
  const sections = await db.homeSection.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const order = sections.map((s) => s.type).filter((t) => t !== "hero");
  const from = order.indexOf(type);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= order.length) return;
  [order[from], order[to]] = [order[to], order[from]];
  await db.$transaction([
    db.homeSection.update({ where: { type: "hero" }, data: { sortOrder: 0 } }),
    ...order.map((t, i) =>
      db.homeSection.update({
        where: { type: t },
        data: { sortOrder: (i + 1) * 10 },
      }),
    ),
  ]);
  await audit(actor, "cms.home_section.moved", "home_section", type, {
    direction,
  });
}

// ─── Halls ──────────────────────────────────────────────────────────────────

/** A venue on the website: name, description and photos. */
export const hallSchema = z.object({
  name: localizedRequired,
  slug: slugSchema,
  description: localizedOptional,
  imageIds: z.array(z.string().max(50)),
  published: z.boolean(),
  sortOrder,
});
export type HallInput = z.infer<typeof hallSchema>;

export async function saveHall(
  actor: Actor,
  id: string | null,
  input: HallInput,
): Promise<string> {
  assertPermission(actor, "cms.edit");
  const existing = id
    ? await db.hall.findUniqueOrThrow({ where: { id } })
    : null;
  assertPublishChange(actor, existing?.published, input.published);
  const slugOwner = await db.hall.findUnique({ where: { slug: input.slug } });
  if (slugOwner && slugOwner.id !== id) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["slug"],
        message: "Another venue already uses this address",
        input: input.slug,
      },
    ]);
  }
  await assertAssetKind(input.imageIds, "IMAGE");
  const data = {
    name: input.name,
    slug: input.slug,
    description: nullableJson(input.description),
    published: input.published,
    sortOrder: input.sortOrder,
  };
  const hallId = await db.$transaction(async (tx) => {
    const hall = id
      ? await tx.hall.update({ where: { id }, data })
      : await tx.hall.create({ data });
    await replacePlacements(tx, "hall", hall.id, input.imageIds);
    return hall.id;
  });
  await audit(
    actor,
    id ? "cms.hall.saved" : "cms.hall.created",
    "hall",
    hallId,
    { slug: input.slug, published: input.published },
  );
  return hallId;
}

/**
 * Deletes a venue. A venue that bookings use can't be deleted (that would
 * break their history) — hide it from the website instead. With
 * `deletePhotos`, its photos that no other page uses are deleted too,
 * including from Cloudinary.
 */
/**
 * Deletes a venue. A venue that bookings (or their history) use can't be
 * removed from the database without breaking those records, so it is
 * archived instead: inactive, off the website, the admin list and new
 * bookings, with its photos taken off. Old bookings still show its name.
 */
export async function deleteHall(
  actor: Actor,
  id: string,
  options: { deletePhotos?: boolean } = {},
): Promise<{ photosDeleted: number; archived: boolean }> {
  assertPermission(actor, "cms.publish");
  const hall = await db.hall.findUniqueOrThrow({ where: { id } });
  const [functions, occupancies, combined] = await Promise.all([
    db.bookingSubEvent.count({ where: { hallId: id } }),
    db.slotOccupancy.count({ where: { physicalHallId: id } }),
    db.hallComposition.count({ where: { memberHallId: id } }),
  ]);
  const archived = functions + occupancies + combined > 0;
  const placements = await db.mediaPlacement.findMany({
    where: { ownerType: "hall", ownerId: id },
    select: { assetId: true },
  });
  await db.$transaction([
    db.mediaPlacement.deleteMany({ where: { ownerType: "hall", ownerId: id } }),
    archived
      ? db.hall.update({
          where: { id },
          // Frees the web address for a new venue with the same name.
          data: {
            active: false,
            published: false,
            slug: `${hall.slug.slice(0, 60)}-archived-${id.slice(-6)}`,
          },
        })
      : db.hall.delete({ where: { id } }),
  ]);
  let photosDeleted = 0;
  if (options.deletePhotos) {
    for (const { assetId } of placements) {
      // Photos still used on another page are kept.
      if ((await assetUsage(assetId)) > 0) continue;
      await deleteAsset(actor, assetId);
      photosDeleted += 1;
    }
  }
  await audit(
    actor,
    archived ? "cms.hall.archived" : "cms.hall.deleted",
    "hall",
    id,
    { slug: hall.slug, photosDeleted, bookingFunctions: functions },
  );
  return { photosDeleted, archived };
}

// ─── Menus ──────────────────────────────────────────────────────────────────

/** "Paneer tikka — smoky, tandoor" → name + description. */
export function parseMenuLine(line: string): {
  name: string;
  description?: string;
} {
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
  courses: z.partialRecord(
    z.enum(MENU_COURSES),
    z.object({ en: z.string().max(10_000), hi: z.string().max(10_000) }),
  ),
});

export async function saveMenu(
  actor: Actor,
  id: string | null,
  input: z.infer<typeof menuSchema>,
): Promise<string> {
  assertPermission(actor, "cms.edit");
  const existing = id
    ? await db.menu.findUniqueOrThrow({ where: { id } })
    : null;
  assertPublishChange(actor, existing?.publicVisible, input.publicVisible);
  const items: Prisma.MenuItemCreateManyMenuInput[] = [];
  for (const course of MENU_COURSES) {
    const lines = input.courses[course];
    if (!lines) continue;
    const en = lines.en
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const hi = lines.hi.split(/\r?\n/).map((l) => l.trim());
    en.forEach((line, index) => {
      const parsedEn = parseMenuLine(line);
      const parsedHi = hi[index] ? parseMenuLine(hi[index]) : null;
      items.push({
        course,
        sortOrder: index,
        name: {
          en: parsedEn.name,
          ...(parsedHi?.name ? { hi: parsedHi.name } : {}),
        },
        description:
          parsedEn.description || parsedHi?.description
            ? {
                en: parsedEn.description ?? "",
                ...(parsedHi?.description ? { hi: parsedHi.description } : {}),
              }
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
    const menu = id
      ? await tx.menu.update({ where: { id }, data })
      : await tx.menu.create({ data });
    // Website menus only; bookings snapshot their own menu copies (Phase 3).
    await tx.menuItem.deleteMany({ where: { menuId: menu.id } });
    if (items.length)
      await tx.menuItem.createMany({
        data: items.map((i) => ({ ...i, menuId: menu.id })),
      });
    return menu.id;
  });
  await audit(
    actor,
    id ? "cms.menu.saved" : "cms.menu.created",
    "menu",
    menuId,
  );
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

export async function saveDecorTheme(
  actor: Actor,
  id: string | null,
  input: z.infer<typeof decorSchema>,
): Promise<string> {
  assertPermission(actor, "cms.edit");
  const existing = id
    ? await db.decorTheme.findUniqueOrThrow({ where: { id } })
    : null;
  assertPublishChange(actor, existing?.published, input.published);
  const owner = await db.decorTheme.findUnique({ where: { slug: input.slug } });
  if (owner && owner.id !== id)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["slug"],
        message: "Another theme uses this address",
        input: input.slug,
      },
    ]);
  await assertAssets(input.imageIds);
  const data = {
    name: input.name,
    slug: input.slug,
    description: nullableJson(input.description),
    published: input.published,
    sortOrder: input.sortOrder,
  };
  const themeId = await db.$transaction(async (tx) => {
    const theme = id
      ? await tx.decorTheme.update({ where: { id }, data })
      : await tx.decorTheme.create({ data });
    await replacePlacements(tx, "decor_theme", theme.id, input.imageIds);
    return theme.id;
  });
  await audit(
    actor,
    id ? "cms.decor.saved" : "cms.decor.created",
    "decor_theme",
    themeId,
  );
  return themeId;
}

export async function deleteDecorTheme(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  await db.$transaction([
    db.mediaPlacement.deleteMany({
      where: { ownerType: "decor_theme", ownerId: id },
    }),
    db.decorTheme.delete({ where: { id } }),
  ]);
  await audit(actor, "cms.decor.deleted", "decor_theme", id);
}

// ─── Gallery ────────────────────────────────────────────────────────────────

/** A gallery photo's only text: its title, shown on hover and in the large view. */
const galleryTitle = z
  .string()
  .trim()
  .max(120, "Keep the title under 120 characters");

export const addGalleryPhotosSchema = z
  .object({
    /** An existing category id, or "new" with `newCategory` filled in. */
    categoryId: z.string().min(1, "Choose a category"),
    newCategory: z.string().trim().max(40, "Keep the name under 40 characters"),
    photos: z.array(
      z.object({ assetId: z.string().min(1), title: galleryTitle }),
    ),
  })
  .superRefine((v, ctx) => {
    if (v.categoryId === "new" && !v.newCategory)
      ctx.addIssue({
        code: "custom",
        path: ["newCategory"],
        message: "Write the new category's name",
      });
    if (!v.photos.length)
      ctx.addIssue({
        code: "custom",
        path: ["photos"],
        message: "Upload at least one photo",
      });
  });

function categoryKey(name: string): string {
  return (
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "category"
  );
}

/** Finds a category by name (any case) or creates it, last in the list. */
async function categoryFor(
  tx: Prisma.TransactionClient,
  categoryId: string,
  newName: string,
) {
  if (categoryId !== "new")
    return (
      await tx.galleryCategory.findUniqueOrThrow({ where: { id: categoryId } })
    ).id;
  const all = await tx.galleryCategory.findMany();
  const same = all.find(
    (c) =>
      (c.name as { en: string }).en.trim().toLowerCase() ===
      newName.toLowerCase(),
  );
  if (same) return same.id;
  let key = categoryKey(newName);
  for (let n = 2; all.some((c) => c.key === key); n++)
    key = `${categoryKey(newName)}-${n}`;
  const last = Math.max(0, ...all.map((c) => c.sortOrder));
  const created = await tx.galleryCategory.create({
    data: { key, name: { en: newName }, sortOrder: last + 10 },
  });
  return created.id;
}

/** Title → the photo's caption, and its alt text for screen readers. Keeps any Hindi already saved. */
function titleData(asset: { alt: unknown; caption: unknown }, title: string) {
  const alt = asset.alt as { en: string; hi?: string };
  const caption = (asset.caption as { en?: string; hi?: string } | null) ?? {};
  if (!title) return { caption: Prisma.DbNull, alt };
  return { caption: { ...caption, en: title }, alt: { ...alt, en: title } };
}

/** Adds freshly uploaded photos, each with its title, to one category (new ones first). */
export async function addGalleryPhotos(
  actor: Actor,
  input: z.infer<typeof addGalleryPhotosSchema>,
) {
  assertPermission(actor, "cms.publish");
  await assertAssets(input.photos.map((p) => p.assetId));
  const categoryId = await db.$transaction(async (tx) => {
    const id = await categoryFor(tx, input.categoryId, input.newCategory);
    const assets = await tx.mediaAsset.findMany({
      where: { id: { in: input.photos.map((p) => p.assetId) } },
    });
    for (const photo of input.photos) {
      const asset = assets.find((a) => a.id === photo.assetId)!;
      await tx.mediaAsset.update({
        where: { id: asset.id },
        data: titleData(asset, photo.title),
      });
    }
    await tx.galleryItem.createMany({
      data: input.photos.map((p) => ({ categoryId: id, assetId: p.assetId })),
      skipDuplicates: true,
    });
    return id;
  });
  await audit(actor, "cms.gallery.added", "gallery_category", categoryId, {
    count: input.photos.length,
  });
}

export const galleryItemSchema = z.object({
  title: galleryTitle,
  categoryId: z.string().min(1, "Choose a category"),
});

/** Changes a gallery photo's title and/or category. */
export async function updateGalleryItem(
  actor: Actor,
  id: string,
  input: z.infer<typeof galleryItemSchema>,
) {
  assertPermission(actor, "cms.publish");
  const item = await db.galleryItem.findUniqueOrThrow({
    where: { id },
    include: { asset: true },
  });
  await db.galleryCategory.findUniqueOrThrow({
    where: { id: input.categoryId },
  });
  if (input.categoryId !== item.categoryId) {
    const clash = await db.galleryItem.findUnique({
      where: {
        categoryId_assetId: {
          categoryId: input.categoryId,
          assetId: item.assetId,
        },
      },
    });
    if (clash)
      throw new z.ZodError([
        {
          code: "custom",
          path: ["categoryId"],
          message: "This photo is already in that category",
          input: input.categoryId,
        },
      ]);
  }
  await db.$transaction([
    db.galleryItem.update({
      where: { id },
      data: { categoryId: input.categoryId },
    }),
    db.mediaAsset.update({
      where: { id: item.assetId },
      data: titleData(item.asset, input.title),
    }),
  ]);
}

/** Takes a photo out of the gallery; its file is deleted when no other page uses it. */
export async function removeGalleryItem(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  const item = await db.galleryItem.delete({ where: { id } });
  await audit(actor, "cms.gallery.removed", "gallery_item", id);
  await dropUnusedPhotos(actor, [item.assetId]);
}

/** Deletes a category that has no photos. */
export async function deleteGalleryCategory(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  const photos = await db.galleryItem.count({ where: { categoryId: id } });
  if (photos)
    throw new RuleError("Move or delete this category's photos first.");
  await db.galleryCategory.delete({ where: { id } });
  await audit(actor, "cms.gallery.category_deleted", "gallery_category", id);
}

// ─── About page photos ──────────────────────────────────────────────────────

/**
 * The About page text is hand-written (static), but its header photo and the
 * owner's portrait are chosen here. Stored as "about_page" placements with
 * ownerId "header" / "owner", so the media library sees them as in use.
 */
export const ABOUT_PHOTO_SLOTS = ["header", "owner"] as const;

export const aboutPhotosSchema = z.object({
  headerAssetId: optionalId,
  ownerAssetId: optionalId,
});

export async function saveAboutPhotos(
  actor: Actor,
  input: z.infer<typeof aboutPhotosSchema>,
) {
  assertPermission(actor, "cms.publish");
  await assertAssetKind([input.headerAssetId, input.ownerAssetId], "IMAGE");
  const before = await db.mediaPlacement.findMany({
    where: { ownerType: "about_page" },
  });
  const chosen = { header: input.headerAssetId, owner: input.ownerAssetId };
  await db.$transaction(async (tx) => {
    await tx.mediaPlacement.deleteMany({ where: { ownerType: "about_page" } });
    for (const slot of ABOUT_PHOTO_SLOTS) {
      const assetId = chosen[slot];
      if (assetId)
        await tx.mediaPlacement.create({
          data: {
            ownerType: "about_page",
            ownerId: slot,
            assetId,
            sortOrder: 0,
          },
        });
    }
  });
  // A replaced or removed photo is deleted from the library and Cloudinary,
  // unless another page still uses it.
  const kept = new Set(Object.values(chosen));
  for (const old of before) {
    if (!kept.has(old.assetId) && (await assetUsage(old.assetId)) === 0)
      await deleteAsset(actor, old.assetId);
  }
  await audit(actor, "cms.about.photos_saved", "website_page", "about", {
    header: input.headerAssetId,
    owner: input.ownerAssetId,
  });
}

// ─── Testimonials ───────────────────────────────────────────────────────────

export const testimonialSchema = z.object({
  name: z.string().trim().min(2, "Enter the guest's name").max(120),
  event: localizedOptional,
  quote: localizedRequired,
  rating: z.coerce
    .number({ message: "Choose 1 to 5 stars" })
    .int()
    .min(1, "Choose 1 to 5 stars")
    .max(5),
  photoAssetId: optionalId,
  consent: z.boolean(),
  published: z.boolean(),
});

/** Deletes photos (or a video) taken off a page, unless another page uses them. */
async function dropUnusedPhotos(actor: Actor, assetIds: string[]) {
  if (!actor.permissions.has("cms.publish")) return;
  for (const assetId of assetIds)
    if ((await assetUsage(assetId)) === 0) await deleteAsset(actor, assetId);
}

export async function saveTestimonial(
  actor: Actor,
  id: string | null,
  input: z.infer<typeof testimonialSchema>,
): Promise<string> {
  assertPermission(actor, "cms.edit");
  const existing = id
    ? await db.testimonial.findUniqueOrThrow({ where: { id } })
    : null;
  assertPublishChange(actor, existing?.published, input.published);
  if (input.published && !input.consent)
    throw new z.ZodError([
      {
        code: "custom",
        path: ["consent"],
        message:
          "Tick the guest's permission before showing this review on the website",
        input: false,
      },
    ]);
  await assertAssetKind([input.photoAssetId], "IMAGE");
  const before = id
    ? await db.mediaPlacement.findMany({
        where: { ownerType: "testimonial", ownerId: id },
      })
    : [];
  const data = {
    name: input.name,
    event: nullableJson(input.event),
    quote: input.quote,
    rating: input.rating,
    consent: input.consent,
    published: input.published,
  };
  const savedId = await db.$transaction(async (tx) => {
    const row = id
      ? await tx.testimonial.update({ where: { id }, data })
      : await tx.testimonial.create({ data });
    await replacePlacements(
      tx,
      "testimonial",
      row.id,
      input.photoAssetId ? [input.photoAssetId] : [],
    );
    return row.id;
  });
  // A replaced or removed photo is deleted from the library and Cloudinary.
  await dropUnusedPhotos(
    actor,
    before.map((p) => p.assetId).filter((a) => a !== input.photoAssetId),
  );
  await audit(
    actor,
    id ? "cms.testimonial.saved" : "cms.testimonial.created",
    "testimonial",
    savedId,
    { published: input.published },
  );
  return savedId;
}

export async function deleteTestimonial(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  const photos = await db.mediaPlacement.findMany({
    where: { ownerType: "testimonial", ownerId: id },
  });
  await db.$transaction([
    db.mediaPlacement.deleteMany({
      where: { ownerType: "testimonial", ownerId: id },
    }),
    db.testimonial.delete({ where: { id } }),
  ]);
  // The guest's photo goes too (library and Cloudinary).
  await dropUnusedPhotos(
    actor,
    photos.map((p) => p.assetId),
  );
  await audit(actor, "cms.testimonial.deleted", "testimonial", id);
}
