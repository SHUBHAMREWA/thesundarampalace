import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const site = env().NEXT_PUBLIC_SITE_URL;
  const isProduction = env().APP_ENV === "production";
  return {
    // Only production is indexed; staging and previews are blocked entirely.
    rules: isProduction
      ? { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] }
      : { userAgent: "*", disallow: "/" },
    sitemap: isProduction ? `${site}/sitemap.xml` : undefined,
  };
}
