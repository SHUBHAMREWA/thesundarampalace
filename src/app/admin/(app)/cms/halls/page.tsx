import { Building2 } from "lucide-react";
import type { Metadata } from "next";

import { SimpleCmsList } from "@/components/cms/simple-list";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Venues" };

export default async function HallsPage() {
  const [halls, placements, page] = await Promise.all([
    db.hall.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.mediaPlacement.findMany({ where: { ownerType: "hall" }, orderBy: { sortOrder: "asc" }, include: { asset: { select: { publicId: true } } } }),
    db.websitePage.findUnique({ where: { kind_slug: { kind: "STANDARD", slug: "venues" } }, select: { id: true } }),
  ]);
  const photos = new Map<string, string[]>();
  for (const p of placements) photos.set(p.ownerId, [...(photos.get(p.ownerId) ?? []), p.asset.publicId]);
  return (
    <SimpleCmsList
      title="Venues"
      description="Halls and lawns: a title, a description and photos. Click a venue to edit it or add photos. Published venues are shown one below the other on the Venues page."
      newHref="/admin/cms/halls/new"
      newLabel="Add venue"
      icon={Building2}
      emptyText="No venues yet"
      showThumbs
      pageHref={page ? `/admin/cms/pages/${page.id}` : null}
      items={halls.map((hall) => {
        const list = photos.get(hall.id) ?? [];
        return {
          id: hall.id,
          href: `/admin/cms/halls/${hall.id}`,
          title: t(hall.name, "en"),
          subtitle: `${list.length} photo${list.length === 1 ? "" : "s"}`,
          live: hall.published,
          warning: list.length ? undefined : "No photos yet",
          thumb: list[0] ?? null,
        };
      })}
    />
  );
}
