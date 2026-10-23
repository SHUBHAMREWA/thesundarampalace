import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/crm/page-header";
import { db } from "@/lib/db";
import { t, type Localized } from "@/lib/i18n/localized";
import { mediaOptions } from "@/server/services/media";

import { PageEditor } from "./page-editor";

export const metadata: Metadata = { title: "Edit page" };

const PUBLIC_PATH: Record<string, (slug: string) => string> = {
  STANDARD: (slug) => (slug === "home" ? "/" : `/${slug}`),
  SERVICE: (slug) => `/services/${slug}`,
  LEGAL: (slug) => `/legal/${slug}`,
};

export default async function EditPagePage({ params }: PageProps<"/admin/cms/pages/[id]">) {
  const { id } = await params;
  const [page, media] = await Promise.all([db.websitePage.findUnique({ where: { id } }), mediaOptions("IMAGE")]);
  if (!page) notFound();
  const seo = (page.seo ?? {}) as { title?: Localized; description?: Localized };
  const path = PUBLIC_PATH[page.kind](page.slug);
  return (
    <>
      <PageHeader
        title={t(page.title, "en")}
        description={`Public address: /en${path === "/" ? "" : path}`}
        crumbs={[{ label: "Website CMS", href: "/admin/cms/pages" }, { label: "Pages", href: "/admin/cms/pages" }, { label: t(page.title, "en") }]}
      />
      <PageEditor
        id={page.id}
        kind={page.kind}
        media={media}
        defaults={{
          title: page.title as Localized,
          summary: (page.summary as Localized | null) ?? null,
          body: (page.body as Localized | null) ?? null,
          heroAssetId: page.heroAssetId,
          seoTitle: seo.title ?? null,
          seoDescription: seo.description ?? null,
          published: page.published,
          sortOrder: page.sortOrder,
        }}
      />
    </>
  );
}
