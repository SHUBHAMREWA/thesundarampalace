import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import type { HomeSectionType } from "@/lib/content/catalog";
import { db } from "@/lib/db";
import type { Localized } from "@/lib/i18n/localized";
import type { SettingsSection } from "@/lib/settings/schemas";
import { istDateKey } from "@/lib/time";
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

async function placementsFor(
  ownerType: string,
  ownerIds: string[],
): Promise<Map<string, MediaView[]>> {
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

function pageView(
  row: Awaited<ReturnType<typeof db.websitePage.findFirst>> & {
    heroAsset: AssetRow | null;
  },
): PageView {
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

export async function getPage(
  kind: PageView["kind"],
  slug: string,
): Promise<PageView | null> {
  "use cache";
  cms();
  const row = await db.websitePage.findFirst({
    where: { kind, slug, published: true },
    include: { heroAsset: true },
  });
  return row ? pageView(row) : null;
}

/** Photo gallery of a standard page (see PAGES_WITH_PHOTOS), in the chosen order. */
export async function getPagePhotos(slug: string): Promise<MediaView[]> {
  "use cache";
  cms();
  const page = await db.websitePage.findFirst({
    where: { kind: "STANDARD", slug, published: true },
    select: { id: true },
  });
  if (!page) return [];
  return (await placementsFor("service_page", [page.id])).get(page.id) ?? [];
}

/** The About page's header photo and owner portrait (chosen in the CMS; the text is static). */
export async function getAboutPhotos(): Promise<{
  header: MediaView | null;
  owner: MediaView | null;
}> {
  "use cache";
  cms();
  const rows = await db.mediaPlacement.findMany({
    where: { ownerType: "about_page" },
    include: { asset: true },
  });
  const find = (slot: string) =>
    media(rows.find((r) => r.ownerId === slot)?.asset);
  return { header: find("header"), owner: find("owner") };
}

export type TestimonialView = {
  id: string;
  name: string;
  event: Partial<Localized> | null;
  quote: Localized;
  rating: number;
  photo: MediaView | null;
};

/** Published guest reviews the guest agreed to share, newest first. */
export async function listTestimonials(): Promise<TestimonialView[]> {
  "use cache";
  cms();
  const rows = await db.testimonial.findMany({
    where: { published: true, consent: true },
    orderBy: { createdAt: "desc" },
  });
  const photos = await placementsFor(
    "testimonial",
    rows.map((r) => r.id),
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    event: (row.event as Partial<Localized> | null) ?? null,
    quote: row.quote as Localized,
    rating: row.rating,
    photo: photos.get(row.id)?.[0] ?? null,
  }));
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

export type CelebrationView = {
  slug: string;
  title: Localized;
  description: Partial<Localized> | null;
  images: MediaView[];
};

/** Published celebrations (SERVICE pages) with their photos; an older header image comes first. */
export async function listCelebrations(): Promise<CelebrationView[]> {
  "use cache";
  cms();
  const rows = await db.websitePage.findMany({
    where: { kind: "SERVICE", published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { heroAsset: true },
  });
  const images = await placementsFor(
    "service_page",
    rows.map((r) => r.id),
  );
  return rows.map((row) => {
    const photos = images.get(row.id) ?? [];
    const hero = media(row.heroAsset);
    return {
      slug: row.slug,
      title: row.title as Localized,
      description: (row.body as Partial<Localized> | null) ?? null,
      images:
        hero && !photos.some((m) => m.publicId === hero.publicId)
          ? [hero, ...photos]
          : photos,
    };
  });
}

// ─── Homepage ───────────────────────────────────────────────────────────────

export type HomeSectionView = {
  type: HomeSectionType;
  visible: boolean;
  heading: Localized | null;
  intro: Localized | null;
  /** Hero only */
  subheading?: Localized | null;
  heroMedia?: "images" | "video";
  slides?: MediaView[];
  video?: MediaView | null;
  videoPath?: string | null;
  poster?: MediaView | null;
  /** Venues, celebrations, catering: left/right picture carousel. */
  pictures: MediaView[];
};

export async function getHomeSections(): Promise<HomeSectionView[]> {
  "use cache";
  cms();
  const rows = await db.homeSection.findMany({ orderBy: { sortOrder: "asc" } });
  const idOf = (v: unknown) =>
    typeof v === "string" && v.length > 0 ? [v] : [];
  const idsOf = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((id): id is string => typeof id === "string")
      : [];
  const wanted = rows.flatMap((r) => {
    const c = r.content as Record<string, unknown>;
    return [
      ...idOf(c.posterAssetId),
      ...idOf(c.videoAssetId),
      ...idsOf(c.slideAssetIds),
      ...idsOf(c.pictureAssetIds),
    ];
  });
  const assets = wanted.length
    ? await db.mediaAsset.findMany({
        where: { id: { in: [...new Set(wanted)] } },
      })
    : [];
  const byId = new Map(assets.map((a) => [a.id, a]));
  const list = (v: unknown) =>
    idsOf(v)
      .map((id) => media(byId.get(id)))
      .filter((m): m is MediaView => m !== null);
  return rows.map((row) => {
    const content = row.content as Record<string, unknown>;
    return {
      type: row.type as HomeSectionType,
      visible: row.visible,
      heading: (content.heading as Localized | null) ?? null,
      intro: (content.intro as Localized | null) ?? null,
      subheading: (content.subheading as Localized | null) ?? null,
      // Older rows have no heroMedia: a saved film meant video.
      heroMedia:
        content.heroMedia === "video" ||
        (!content.heroMedia && (content.videoPath || content.videoAssetId))
          ? "video"
          : "images",
      slides: list(content.slideAssetIds),
      video: media(
        typeof content.videoAssetId === "string"
          ? byId.get(content.videoAssetId)
          : null,
      ),
      videoPath:
        typeof content.videoPath === "string" ? content.videoPath : null,
      poster: media(
        typeof content.posterAssetId === "string"
          ? byId.get(content.posterAssetId)
          : null,
      ),
      pictures: list(content.pictureAssetIds),
    };
  });
}

// ─── Venues ─────────────────────────────────────────────────────────────────

export type HallView = {
  slug: string;
  name: Localized;
  description: Localized | null;
  images: MediaView[];
};

export async function listHalls(): Promise<HallView[]> {
  "use cache";
  cms();
  const rows = await db.hall.findMany({
    where: { published: true, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const images = await placementsFor(
    "hall",
    rows.map((r) => r.id),
  );
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name as Localized,
    description: (row.description as Localized | null) ?? null,
    images: images.get(row.id) ?? [],
  }));
}

// ─── Catering, décor, gallery, dates ─────────────────────────────

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

export type DecorThemeView = {
  slug: string;
  name: Localized;
  description: Localized | null;
  images: MediaView[];
};

export async function listDecorThemes(): Promise<DecorThemeView[]> {
  "use cache";
  cms();
  const rows = await db.decorTheme.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const images = await placementsFor(
    "decor_theme",
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name as Localized,
    description: (r.description as Localized | null) ?? null,
    images: images.get(r.id) ?? [],
  }));
}

export type GalleryView = {
  categories: { key: string; name: Localized }[];
  /** Newest first. */
  items: { categoryKey: string; asset: MediaView }[];
};

export async function getGallery(): Promise<GalleryView> {
  "use cache";
  cms();
  const [categories, items] = await Promise.all([
    db.galleryCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    db.galleryItem.findMany({
      orderBy: { createdAt: "desc" },
      include: { asset: true, category: true },
    }),
  ]);
  return {
    categories: categories.map((c) => ({
      key: c.key,
      name: c.name as Localized,
    })),
    items: items
      .filter((i) => i.asset.kind === "IMAGE")
      .map((i) => ({ categoryKey: i.category.key, asset: media(i.asset)! })),
  };
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

// ─── Blog ───────────────────────────────────────────────────────────────────

export type BlogPostSummaryView = {
  slug: string;
  title: Localized;
  summary: Localized | null;
  cover: MediaView | null;
  author: string;
  category: { key: string; name: Localized };
  tags: string[];
  publishedAt: string | null;
  /** Publication day in India ("YYYY-MM-DD"), for display without reading the clock. */
  publishedOn: string | null;
  updatedAt: string;
  /** Has its own Hindi title and article (otherwise only the English page is offered to search engines). */
  hindi: boolean;
};

export type BlogPostView = BlogPostSummaryView & {
  content: Localized;
  seo: { title: Localized | null; description: Localized | null };
};

type BlogRow = Awaited<
  ReturnType<
    typeof db.blogPost.findFirstOrThrow<{ include: { category: true } }>
  >
>;

function blogSummary(
  row: BlogRow,
  cover: MediaView | null,
): BlogPostSummaryView {
  return {
    slug: row.slug,
    title: row.title as Localized,
    summary: (row.summary as Localized | null) ?? null,
    cover,
    author: row.author,
    category: { key: row.category.key, name: row.category.name as Localized },
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    publishedAt: row.publishedAt?.toISOString() ?? null,
    publishedOn: row.publishedAt ? istDateKey(row.publishedAt) : null,
    updatedAt: row.updatedAt.toISOString(),
    hindi:
      !!(row.title as Localized).hi?.trim() &&
      !!(row.content as Localized | null)?.hi?.trim(),
  };
}

/** Published posts, newest first. */
export async function listBlogPosts(): Promise<BlogPostSummaryView[]> {
  "use cache";
  cms();
  const rows = await db.blogPost.findMany({
    where: { published: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: { category: true },
  });
  const covers = await placementsFor(
    "blog_post",
    rows.map((r) => r.id),
  );
  return rows.map((r) => blogSummary(r, covers.get(r.id)?.[0] ?? null));
}

export async function getBlogPost(slug: string): Promise<BlogPostView | null> {
  "use cache";
  cms();
  const row = await db.blogPost.findFirst({
    where: { slug, published: true },
    include: { category: true },
  });
  if (!row) return null;
  const covers = await placementsFor("blog_post", [row.id]);
  return {
    ...blogSummary(row, covers.get(row.id)?.[0] ?? null),
    content: row.content as Localized,
    seo: {
      title: (row.metaTitle as Localized | null) ?? null,
      description: (row.metaDescription as Localized | null) ?? null,
    },
  };
}
