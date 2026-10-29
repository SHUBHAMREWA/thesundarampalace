import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/crm/page-header";
import { db } from "@/lib/db";
import { t, type Localized } from "@/lib/i18n/localized";
import { cloudinaryConfigured, mediaOptions } from "@/server/services/media";

import { HallEditor, type HallDefaults } from "./hall-editor";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Edit venue" };

const EMPTY: HallDefaults = { name: null, slug: "", description: null, imageIds: [], published: false, sortOrder: 0 };

export default async function EditHallPage({ params }: PageProps<"/admin/cms/halls/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const [hall, images, placements] = await Promise.all([
    isNew ? null : db.hall.findUnique({ where: { id } }),
    mediaOptions("IMAGE"),
    isNew ? [] : db.mediaPlacement.findMany({ where: { ownerType: "hall", ownerId: id }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!isNew && !hall) notFound();

  const defaults: HallDefaults = hall
    ? {
        name: hall.name as Localized,
        slug: hall.slug,
        description: (hall.description as Localized | null) ?? null,
        imageIds: placements.map((p) => p.assetId),
        published: hall.published,
        sortOrder: hall.sortOrder,
      }
    : EMPTY;

  const title = hall ? t(hall.name, "en") : "New venue";
  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: "Website CMS", href: "/admin/cms/pages" }, { label: "Venues", href: "/admin/cms/halls" }, { label: title }]}
      />
      <HallEditor id={hall?.id ?? null} defaults={defaults} images={images} uploads={cloudinaryConfigured()} />
    </>
  );
}
