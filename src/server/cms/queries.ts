import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { HomeSectionType } from "@/lib/content/catalog";
import { db } from "@/lib/db";
import type { Localized } from "@/lib/i18n/localized";
import type { SettingsSection } from "@/lib/settings/schemas";
import { getSettings } from "@/server/services/settings";

/**
 * Cached reads for the public website. Everything here is tagged "cms" and
 * kept until a CMS save calls updateTag("cms") — so visitors get static pages
 * and the free-tier database stays asleep (docs/architecture.md ADR-02/03).
 * Return values are plain, serializable objects (no Decimal or Date).
 */
export const CMS_TAG = "cms";

function cms() {
  cacheTag(CMS_TAG);
  cacheLife("max");
}

export type MediaView = {
  publicId: string;
  resourceType: string;
  format: string | null;
  width: number | null;
  height: number | null;
  alt: Localized;
  caption: Localized | null;
  photographerCredit: string | null;
};

type AssetRow = {
  publicId: string;
  resourceType: string;
  format: string | null;
  width: number | null;
  height: number | null;
  alt: unknown;
  caption: unknown;
  photographerCredit: string | null;
};

function media(asset: AssetRow | null | undefined): MediaView | null {
  if (!asset) return null;
  return {
    publicId: asset.publicId,
    resourceType: asset.resourceType,
    format: asset.format,
    width: asset.width,
    height: asset.height,
    alt: asset.alt as Localized,
    caption: (asset.caption as Localized | null) ?? null,
    photographerCredit: asset.photographerCredit,
  };
}

async function placementsFor(ownerType: string, ownerIds: string[]): Promise<Map<string, MediaView[]>> {
  const rows = await db.mediaPlacement.findMany({
    where: { ownerType, ownerId: { in: ownerIds } },
    orderBy: { sortOrder: "asc" },
    include: { asset: true },
  });
  const map = new Map<string, MediaView[]>();
  for (const row of rows) {
    const list = map.get(row.ownerId) ?? [];
    const view = media(row.asset);
    if (view) list.push(view);
    map.set(row.ownerId, list);
  }
  return map;
}

// ─── Pages ──────────────────────────────────────────────────────────────────

export type PageView = {
  kind: "STANDARD" | "SERVICE" | "LEGAL";
  slug: string;
  title: Localized;
  summary: Localized | null;
  body: Partial<Localized> | null;
  hero: MediaView | null;
  seo: { title?: Localized; description?: Localized } | null;
  updatedAt: string;
};

function pageView(row: Awaited<ReturnType<typeof db.websitePage.findFirst>> & { heroAsset: AssetRow | null }): PageView {
  return {
    kind: row.kind,
    slug: row.slug,
    title: row.title as Localized,
    summary: (row.summary as Localized | null) ?? null,
    body: (row.body as Partial<Localized> | null) ?? null,
    hero: media(row.heroAsset),
    seo: (row.seo as PageView["seo"]) ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getPage(kind: PageView["kind"], slug: string): Promise<PageView | null> {
  "use cache";
  cms();
  const row = await db.websitePage.findFirst({
    where: { kind, slug, published: true },
    include: { heroAsset: true },
  });
  return row ? pageView(row) : null;
}

export async function listPages(kind: PageView["kind"]): Promise<PageView[]> {
  "use cache";
  cms();
  const rows = await db.websitePage.findMany({
    where: { kind, published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { heroAsset: true },
  });
  return rows.map(pageView);
}

// ─── Homepage ───────────────────────────────────────────────────────────────

export type HomeSectionView = {
  type: HomeSectionType;
  visible: boolean;
  heading: Localized | null;
  intro: Localized | null;
  /** Hero only */
  subheading?: Localized | null;
  videoPath?: string | null;
  poster?: MediaView | null;
};

export async function getHomeSections(): Promise<HomeSectionView[]> {
  "use cache";
  cms();
  const rows = await db.homeSection.findMany({ orderBy: { sortOrder: "asc" } });
  const posterIds = rows
    .map((r) => (r.content as Record<string, unknown>).posterAssetId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const posters = posterIds.length
    ? await db.mediaAsset.findMany({ where: { id: { in: posterIds } } })
    : [];
  return rows.map((row) => {
    const content = row.content as Record<string, unknown>;
    const poster = posters.find((p) => p.id === content.posterAssetId);
    return {
      type: row.type as HomeSectionType,
      visible: row.visible,
      heading: (content.heading as Localized | null) ?? null,
      intro: (content.intro as Localized | null) ?? null,
      subheading: (content.subheading as Localized | null) ?? null,
      videoPath: typeof content.videoPath === "string" ? content.videoPath : null,
      poster: media(poster),
    };
  });
}

// ─── Venues ─────────────────────────────────────────────────────────────────

export type HallView = {
  slug: string;
  name: Localized;
  summary: Localized | null;
  description: Localized | null;
  areaSqFt: number | null;
  ceilingHeightFt: string | null;
  facilities: { key: string; note?: string }[];
  eventTypeKeys: string[];
  slotsInfo: Localized | null;
  hero: MediaView | null;
  floorPlan: MediaView | null;
  images: MediaView[];
  tourUrl: string | null;
  seo: { title?: Localized; description?: Localized } | null;
  capacities: { layout: string; minGuests: number | null; maxGuests: number | null }[];
};

export async function listHalls(): Promise<HallView[]> {
  "use cache";
  cms();
  const rows = await db.hall.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { heroAsset: true, floorPlanAsset: true, capacities: true },
  });
  const images = await placementsFor("hall", rows.map((r) => r.id));
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name as Localized,
    summary: (row.summary as Localized | null) ?? null,
    description: (row.description as Localized | null) ?? null,
    areaSqFt: row.areaSqFt,
    ceilingHeightFt: row.ceilingHeightFt ? row.ceilingHeightFt.toString() : null,
    facilities: (row.facilities as HallView["facilities"]) ?? [],
    eventTypeKeys: (row.eventTypeKeys as string[]) ?? [],
    slotsInfo: (row.slotsInfo as Localized | null) ?? null,
    hero: media(row.heroAsset),
    floorPlan: media(row.floorPlanAsset),
    images: images.get(row.id) ?? [],
    tourUrl: row.tourUrl,
    seo: (row.seo as HallView["seo"]) ?? null,
    capacities: row.capacities.map((c) => ({ layout: c.layout, minGuests: c.minGuests, maxGuests: c.maxGuests })),
  }));
}

export async function getHall(slug: string): Promise<HallView | null> {
  const halls = await listHalls();
  return halls.find((h) => h.slug === slug) ?? null;
}

// ─── Catering, décor, packages, gallery, dates ─────────────────────────────

export type MenuView = {
  id: string;
  name: Localized;
  category: string;
  description: Localized | null;
  items: { course: string; name: Localized; description: Localized | null }[];
};

export async function listPublicMenus(): Promise<MenuView[]> {
  "use cache";
  cms();
  const rows = await db.menu.findMany({
    where: { publicVisible: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return rows.map((m) => ({
    id: m.id,
    name: m.name as Localized,
    category: m.category,
    description: (m.description as Localized | null) ?? null,
    items: m.items.map((i) => ({
      course: i.course,
      name: i.name as Localized,
      description: (i.description as Localized | null) ?? null,
    })),
  }));
}

export type DecorThemeView = { slug: string; name: Localized; description: Localized | null; images: MediaView[] };

export async function listDecorThemes(): Promise<DecorThemeView[]> {
  "use cache";
  cms();
  const rows = await db.decorTheme.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const images = await placementsFor("decor_theme", rows.map((r) => r.id));
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name as Localized,
    description: (r.description as Localized | null) ?? null,
    images: images.get(r.id) ?? [],
  }));
}

export type PackageView = {
  slug: string;
  name: Localized;
  description: Localized | null;
  inclusions: Localized | null;
  addOns: Localized | null;
  terms: Localized | null;
  /** Only present when an administrator enabled public prices. */
  publicPrice: string | null;
  publicPriceNote: Localized | null;
};

export async function listPackages(): Promise<PackageView[]> {
  "use cache";
  cms();
  const rows = await db.package.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((p) => ({
    slug: p.slug,
    name: p.name as Localized,
    description: (p.description as Localized | null) ?? null,
    inclusions: (p.inclusions as Localized | null) ?? null,
    addOns: (p.addOns as Localized | null) ?? null,
    terms: (p.terms as Localized | null) ?? null,
    publicPrice: p.showPublicPrice && p.publicPrice ? p.publicPrice.toFixed(2) : null,
    publicPriceNote: p.showPublicPrice ? ((p.publicPriceNote as Localized | null) ?? null) : null,
  }));
}

export type GalleryView = {
  categories: { key: string; name: Localized }[];
  items: { categoryKey: string; featured: boolean; asset: MediaView }[];
};

export async function getGallery(): Promise<GalleryView> {
  "use cache";
  cms();
  const [categories, items] = await Promise.all([
    db.galleryCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    db.galleryItem.findMany({
      orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      include: { asset: true, category: true },
    }),
  ]);
  return {
    categories: categories.map((c) => ({ key: c.key, name: c.name as Localized })),
    items: items
      .filter((i) => i.asset.kind === "IMAGE")
      .map((i) => ({ categoryKey: i.category.key, featured: i.featured, asset: media(i.asset)! })),
  };
}

export type DateView = { date: string; label: Localized; note: Localized | null };

export async function listAuspiciousDates(): Promise<DateView[]> {
  "use cache";
  cms();
  const rows = await db.auspiciousDate.findMany({ where: { published: true }, orderBy: { date: "asc" } });
  return rows.map((d) => ({
    date: d.date.toISOString().slice(0, 10),
    label: d.label as Localized,
    note: (d.note as Localized | null) ?? null,
  }));
}

export type EventTypeView = { key: string; label: Localized };

export async function listEventTypes(): Promise<EventTypeView[]> {
  "use cache";
  cms();
  const rows = await db.lookupValue.findMany({
    where: { listKey: "event_type", active: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({ key: r.key, label: r.label as Localized }));
}

// ─── Contact details ────────────────────────────────────────────────────────

export type PublicContact = {
  displayName: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  officeHours: string | null;
  contact: SettingsSection<"contact">;
  responseTimePromise: Localized | null;
};

export async function getPublicContact(): Promise<PublicContact> {
  "use cache";
  cms();
  const [business, contact, enquiry] = await Promise.all([
    getSettings("business"),
    getSettings("contact"),
    getSettings("enquiry"),
  ]);
  return {
    displayName: business.displayName,
    address: business.address,
    city: business.city,
    phone: business.phone,
    whatsapp: business.whatsapp,
    email: business.email,
    officeHours: business.officeHours,
    contact,
    responseTimePromise: enquiry.responseTimePromise,
  };
}
