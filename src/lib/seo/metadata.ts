import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

/** "/en/venues" for locale "en" and path "/venues" ("/" → "/en"). */
export function localePath(locale: string, path: string): string {
  const clean = path === "/" ? "" : path;
  return `/${locale}${clean}`;
}

/**
 * Canonical URL plus hreflang alternates (and x-default). `locales` limits the
 * alternates to the languages the page is really written in; a page shown in
 * another locale points its canonical at the default (or first) one.
 */
export function alternatesFor(
  locale: string,
  path: string,
  locales: readonly string[] = routing.locales,
): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[l] = localePath(l, path);
  const fallback = locales.includes(routing.defaultLocale)
    ? routing.defaultLocale
    : locales[0];
  languages["x-default"] = localePath(fallback, path);
  const canonical = localePath(locales.includes(locale) ? locale : fallback, path);
  return { canonical, languages };
}

export const SITE_NAME = "The Sundaram Palace";

/** RSS feed of the blog (src/app/rss.xml). */
export const BLOG_RSS_URL = "/rss.xml";

/** Branded 1200×630 share image (public/og-image.png), used when a page has no photo of its own. */
export const DEFAULT_OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: SITE_NAME,
};

/** "Venues" → "Venues · The Sundaram Palace"; titles that already name the venue stay as they are. */
export function brandedTitle(title: string): string {
  return !title || title.includes("Sundaram") || title.includes("सुंदरम")
    ? title || SITE_NAME
    : `${title} · ${SITE_NAME}`;
}

/**
 * Title, description, canonical + hreflang, Open Graph and Twitter card for a
 * public page. Every page shares a large image: its own photo or the default.
 */
export function pageMetadata(options: {
  locale: string;
  path: string;
  title: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  type?: "website" | "article";
  /** Languages this page is written in (default: all). */
  locales?: readonly string[];
  noindex?: boolean;
}): Metadata {
  const {
    locale,
    path,
    title,
    description,
    imageUrl,
    imageAlt,
    type,
    locales,
    noindex,
  } = options;
  const shareTitle = brandedTitle(title);
  const images = imageUrl
    ? [{ url: imageUrl, alt: imageAlt || shareTitle }]
    : [DEFAULT_OG_IMAGE];
  return {
    title,
    ...(description ? { description } : {}),
    alternates: alternatesFor(locale, path, locales),
    openGraph: {
      title: shareTitle,
      ...(description ? { description } : {}),
      url: localePath(locale, path),
      siteName: SITE_NAME,
      locale: locale === "hi" ? "hi_IN" : "en_IN",
      alternateLocale: locale === "hi" ? "en_IN" : "hi_IN",
      type: type ?? "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      ...(description ? { description } : {}),
      images: images.map((i) => i.url),
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
