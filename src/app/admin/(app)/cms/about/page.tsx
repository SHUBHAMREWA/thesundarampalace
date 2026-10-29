import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { db } from "@/lib/db";
import { cloudinaryConfigured, mediaOptions } from "@/server/services/media";

import { AboutPhotosForm } from "./about-form";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "About page" };

export default async function AboutCmsPage() {
  const [media, placements] = await Promise.all([
    mediaOptions("IMAGE"),
    db.mediaPlacement.findMany({ where: { ownerType: "about_page" } }),
  ]);
  const chosen = (slot: string) => placements.find((p) => p.ownerId === slot)?.assetId ?? null;
  return (
    <>
      <PageHeader
        title="About page"
        description="Public address: /en/about. The text is fixed on the website; only the photos are chosen here."
        crumbs={[{ label: "Website CMS", href: "/admin/cms/pages" }, { label: "About" }]}
      />
      <AboutPhotosForm media={media} uploads={cloudinaryConfigured()} defaults={{ headerAssetId: chosen("header"), ownerAssetId: chosen("owner") }} />
    </>
  );
}
