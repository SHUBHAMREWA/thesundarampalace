import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { documentPreviewHeaders, staticSecurityHeaders } from "./src/lib/security/headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  experimental: {
    authInterrupts: true, // enables forbidden() for permission checks
    // Private document uploads (max 4 MB, Settings → Document wording).
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    loader: "custom",
    loaderFile: "./src/lib/media/image-loader.ts",
  },
  // Documents embed these fonts and read the colour tokens at runtime
  // (src/server/documents/assets.ts), so ship them with those routes.
  outputFileTracingIncludes: {
    "/api/documents/*": ["./src/lib/pdf/fonts/*.woff2", "./src/app/globals.css"],
    "/admin/*": ["./src/lib/pdf/fonts/*.woff2", "./src/app/globals.css"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: staticSecurityHeaders() },
      // The document preview is framed by the CRM (later rules override earlier ones).
      { source: "/api/documents/preview", headers: documentPreviewHeaders() },
    ];
  },
};

export default withNextIntl(nextConfig);
