import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/crm/page-header";
import { db } from "@/lib/db";
import { t, type Localized } from "@/lib/i18n/localized";
import { lookupOptions } from "@/server/services/lookups";
import { mediaOptions } from "@/server/services/media";

import { HallEditor, type HallDefaults } from "./hall-editor";

export const metadata: Metadata = { title: "Edit venue" };

const EMPTY: HallDefaults = {
  name: null,
  slug: "",
  summary: null,
  description: null,
  areaSqFt: "",
  ceilingHeightFt: "",
  capacities: {},
  facilities: {},
  eventTypeKeys: [],
  slotsInfo: null,
  heroAssetId: null,
  floorPlanAssetId: null,
  imageIds: [],
  tourUrl: "",
  seoTitle: null,
  seoDescription: null,
  published: false,
  sortOrder: 0,
};

export default async function EditHallPage({ params }: PageProps<"/admin/cms/halls/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const [hall, media, eventTypes, placements] = await Promise.all([
    isNew ? null : db.hall.findUnique({ where: { id }, include: { capacities: true } }),
    mediaOptions(),
    lookupOptions("event_type"),
    isNew ? [] : db.mediaPlacement.findMany({ where: { ownerType: "hall", ownerId: id }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!isNew && !hall) notFound();

  const seo = (hall?.seo ?? {}) as { title?: Localized; description?: Localized };
  const defaults: HallDefaults = hall
    ? {
        name: hall.name as Localized,
        slug: hall.slug,
        summary: (hall.summary as Localized | null) ?? null,
        description: (hall.description as Localized | null) ?? null,
        areaSqFt: hall.areaSqFt?.toString() ?? "",
        ceilingHeightFt: hall.ceilingHeightFt ? Number(hall.ceilingHeightFt).toString() : "",
        capacities: Object.fromEntries(
          hall.capacities.map((c) => [c.layout, { min: c.minGuests?.toString() ?? "", max: c.maxGuests?.toString() ?? "" }]),
        ),
        facilities: Object.fromEntries(
          ((hall.facilities as { key: string; note?: string }[]) ?? []).map((f) => [f.key, f.note ?? ""]),
        ),
        eventTypeKeys: (hall.eventTypeKeys as string[]) ?? [],
        slotsInfo: (hall.slotsInfo as Localized | null) ?? null,
        heroAssetId: hall.heroAssetId,
        floorPlanAssetId: hall.floorPlanAssetId,
        imageIds: placements.map((p) => p.assetId),
        tourUrl: hall.tourUrl ?? "",
        seoTitle: seo.title ?? null,
        seoDescription: seo.description ?? null,
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
      <HallEditor
        id={hall?.id ?? null}
        defaults={defaults}
        media={media}
        eventTypes={eventTypes.map((e) => ({ value: e.value, label: e.label }))}
      />
    </>
  );
}
