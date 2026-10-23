import "server-only";

import type { Metadata } from "next";
import { currentLocale } from "@/i18n/current";

import { t } from "@/lib/i18n/localized";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { pageMetadata } from "@/lib/seo/metadata";

import { getPage, type PageView } from "./queries";

/** Title, description, canonical + hreflang and Open Graph from a CMS page. */
export async function metadataForPage(kind: PageView["kind"], slug: string, path: string): Promise<Metadata> {
  const locale = await currentLocale();
  const page = await getPage(kind, slug);
  if (!page) return { alternates: pageMetadata({ locale, path, title: "" }).alternates };
  const title = t(page.seo?.title, locale) || t(page.title, locale);
  const description = t(page.seo?.description, locale) || t(page.summary, locale);
  return pageMetadata({
    locale,
    path,
    title,
    description,
    imageUrl: page.hero ? cloudinaryImageUrl(page.hero.publicId, 1200) : undefined,
  });
}
