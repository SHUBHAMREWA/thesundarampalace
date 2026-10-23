import { Flower2 } from "lucide-react";
import type { Metadata } from "next";

import { SimpleCmsList } from "@/components/cms/simple-list";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Décor themes" };

export default async function DecorPage() {
  const [themes, placements] = await Promise.all([
    db.decorTheme.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.mediaPlacement.groupBy({ by: ["ownerId"], where: { ownerType: "decor_theme" }, _count: true }),
  ]);
  const counts = new Map(placements.map((p) => [p.ownerId, p._count]));
  return (
    <SimpleCmsList
      title="Décor themes"
      description="Theme setups (floral, royal, pastel, mandap, stage) with photographs."
      newHref="/admin/cms/decor/new"
      newLabel="Add theme"
      icon={Flower2}
      emptyText="No décor themes yet"
      items={themes.map((theme) => ({
        id: theme.id,
        href: `/admin/cms/decor/${theme.id}`,
        title: t(theme.name, "en"),
        subtitle: `/decor#${theme.slug}`,
        live: theme.published,
        warning: counts.get(theme.id) ? undefined : "No photos",
      }))}
    />
  );
}
