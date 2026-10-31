import "server-only";

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { t } from "@/lib/i18n/localized";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { pageMetadata } from "@/lib/seo/metadata";

import { getPage, type PageView } from "./queries";

/** Pages with a default description in messages (seo.*) for when the CMS has none. */
const DEFAULT_DESCRIPTIONS = [
  "venues",
  "gallery",
  "catering",
  "decor",
  "services",
  "plan-your-event",
] as const;

/** Title, description, canonical + hreflang, Open Graph and Twitter card from a CMS page. */
export async function metadataForPage(
  kind: PageView["kind"],
  slug: string,
  path: string,
): Promise<Metadata> {
  const locale = await currentLocale();
  const [page, seo] = await Promise.all([
    getPage(kind, slug),
    getTranslations("seo"),
  ]);
  const fallback =
    kind === "LEGAL"
      ? seo("legal")
      : (DEFAULT_DESCRIPTIONS as readonly string[]).includes(slug)
        ? seo(slug as (typeof DEFAULT_DESCRIPTIONS)[number])
        : undefined;
  if (!page) {
    // No CMS row yet: keep the site title from the layout.
    const { title: _omit, ...rest } = pageMetadata({
      locale,
      path,
      title: "",
      description: fallback,
    });
    return rest;
  }
  const title = t(page.seo?.title, locale) || t(page.title, locale);
  const description =
    t(page.seo?.description, locale) || t(page.summary, locale) || fallback;
  return pageMetadata({
    locale,
    path,
    title,
    description,
    imageUrl: page.hero
      ? cloudinaryImageUrl(page.hero.publicId, 1200)
      : undefined,
    imageAlt: page.hero ? t(page.hero.alt, locale) : undefined,
  });
}
