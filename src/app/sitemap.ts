import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { STANDARD_PAGES } from "@/lib/content/catalog";
import { env } from "@/lib/env";
import { listHalls, listPages } from "@/server/cms/queries";

/** Public pages in both languages with hreflang alternates. CRM is never listed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = env().NEXT_PUBLIC_SITE_URL;
  const [standard, services, legal, halls] = await Promise.all([
    listPages("STANDARD"),
    listPages("SERVICE"),
    listPages("LEGAL"),
    listHalls(),
  ]);
  const publishedStandard = new Set(standard.map((p) => p.slug));
  const paths = [
    ...STANDARD_PAGES.filter((p) => p.slug === "home" || publishedStandard.has(p.slug)).map((p) => p.path),
    ...services.map((p) => `/services/${p.slug}`),
    ...legal.map((p) => `/legal/${p.slug}`),
    ...halls.map((h) => `/venues/${h.slug}`),
  ];
  const url = (locale: string, path: string) => `${site}/${locale}${path === "/" ? "" : path}`;
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: url(locale, path),
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, url(l, path)])) },
      changeFrequency: "weekly" as const,
      priority: path === "/" ? 1 : path.startsWith("/legal") ? 0.2 : 0.7,
    })),
  );
}
