import type { Metadata } from "next";

import { routing } from "@/i18n/routing";

/** "/en/venues" for locale "en" and path "/venues" ("/" → "/en"). */
export function localePath(locale: string, path: string): string {
  const clean = path === "/" ? "" : path;
  return `/${locale}${clean}`;
}

/** Canonical URL plus hreflang alternates for both locales (and x-default). */
export function alternatesFor(locale: string, path: string): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = localePath(l, path);
  languages["x-default"] = localePath(routing.defaultLocale, path);
  return { canonical: localePath(locale, path), languages };
}

export function pageMetadata(options: {
  locale: string;
  path: string;
  title: string;
  description?: string;
  imageUrl?: string;
  noindex?: boolean;
}): Metadata {
  const { locale, path, title, description, imageUrl, noindex } = options;
  return {
    title,
    description: description || undefined,
    alternates: alternatesFor(locale, path),
    openGraph: {
      title,
      description: description || undefined,
      url: localePath(locale, path),
      siteName: "The Sundaram Palace",
      locale: locale === "hi" ? "hi_IN" : "en_IN",
      type: "website",
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
