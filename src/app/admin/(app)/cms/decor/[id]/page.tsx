import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/crm/page-header";
import { db } from "@/lib/db";
import { t, type Localized } from "@/lib/i18n/localized";
import { mediaOptions } from "@/server/services/media";

import { DecorEditor } from "./decor-editor";

export const metadata: Metadata = { title: "Edit décor theme" };

export default async function EditDecorPage({ params }: PageProps<"/admin/cms/decor/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const [theme, media, placements] = await Promise.all([
    isNew ? null : db.decorTheme.findUnique({ where: { id } }),
    mediaOptions("IMAGE"),
    isNew ? [] : db.mediaPlacement.findMany({ where: { ownerType: "decor_theme", ownerId: id }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!isNew && !theme) notFound();
  const title = theme ? t(theme.name, "en") : "New décor theme";
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: "Website CMS", href: "/admin/cms/pages" }, { label: "Décor", href: "/admin/cms/decor" }, { label: title }]} />
      <DecorEditor
        id={theme?.id ?? null}
        media={media}
        defaults={{
          name: (theme?.name as Localized) ?? null,
          slug: theme?.slug ?? "",
          description: (theme?.description as Localized | null) ?? null,
          imageIds: placements.map((p) => p.assetId),
          published: theme?.published ?? false,
          sortOrder: theme?.sortOrder ?? 0,
        }}
      />
    </>
  );
}
