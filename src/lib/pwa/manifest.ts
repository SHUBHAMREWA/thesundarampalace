import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import type { MetadataRoute } from "next";

/** A colour token's value from globals.css (the only place colours are written). Read at build time. */
function token(name: string): string | undefined {
  const css = readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
  return css.match(new RegExp(`--${name}:\s*([^;]+);`))?.[1].trim();
}

const ICONS: MetadataRoute.Manifest["icons"] = [
  { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

/**
 * Installable-app manifests ("Add to home screen" / "Install app"): one for the
 * public website and one for the staff CRM, each opening in its own window.
 */
export function appManifest(app: "website" | "crm"): MetadataRoute.Manifest {
  const crm = app === "crm";
  return {
    id: crm ? "/admin" : "/",
    name: crm ? "Sundaram Palace CRM" : "The Sundaram Palace",
    short_name: crm ? "SP CRM" : "Sundaram Palace",
    description: crm
      ? "Leads, bookings, payments and the food menu for The Sundaram Palace team."
      : "Weddings and celebrations at The Sundaram Palace, Rewa.",
    start_url: crm ? "/admin" : "/",
    scope: crm ? "/admin/" : "/",
    display: "standalone",
    orientation: "any",
    background_color: token("color-bg"),
    theme_color: token("color-primary-deep"),
    categories: crm ? ["business", "productivity"] : ["lifestyle", "events"],
    icons: ICONS,
  };
}

export function manifestResponse(app: "website" | "crm"): Response {
  return new Response(JSON.stringify(appManifest(app)), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
