import { Flower2 } from "lucide-react";
import type { Metadata } from "next";

import { SimpleCmsList } from "@/components/cms/simple-list";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Décor themes" };

export default async function DecorPage() {
  const [themes, placements, page] = await Promise.all([
    db.decorTheme.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.mediaPlacement.findMany({ where: { ownerType: "decor_theme" }, orderBy: { sortOrder: "asc" }, include: { asset: { select: { publicId: true } } } }),
    db.websitePage.findUnique({ where: { kind_slug: { kind: "STANDARD", slug: "decor" } }, select: { id: true } }),
  ]);
  const photos = new Map<string, string[]>();
  for (const p of placements) photos.set(p.ownerId, [...(photos.get(p.ownerId) ?? []), p.asset.publicId]);
  return (
    <SimpleCmsList
      title="Décor themes"
      description="Décor themes: a title, a description and photos. Click a theme to edit it or add photos."
      newHref="/admin/cms/decor/new"
      newLabel="Add theme"
      icon={Flower2}
      emptyText="No décor themes yet"
      showThumbs
      pageHref={page ? `/admin/cms/pages/${page.id}` : null}
      items={themes.map((theme) => ({
        id: theme.id,
        href: `/admin/cms/decor/${theme.id}`,
        title: t(theme.name, "en"),
        subtitle: `${photos.get(theme.id)?.length ?? 0} photos`,
        live: theme.published,
        warning: photos.get(theme.id)?.length ? undefined : "No photos yet",
        thumb: photos.get(theme.id)?.[0] ?? null,
      }))}
    />
  );
}
