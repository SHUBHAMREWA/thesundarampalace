import { UtensilsCrossed } from "lucide-react";
import type { Metadata } from "next";

import { SimpleCmsList } from "@/components/cms/simple-list";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import en from "@messages/en.json";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Menus" };

export default async function MenusPage() {
  const menus = await db.menu.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { items: true } } },
  });
  return (
    <SimpleCmsList
      title="Menus"
      description="Sample menus for the Catering page. Per-plate rates and booking menus arrive in Phase 3."
      newHref="/admin/cms/menus/new"
      newLabel="Add menu"
      icon={UtensilsCrossed}
      emptyText="No menus yet"
      items={menus.map((m) => ({
        id: m.id,
        href: `/admin/cms/menus/${m.id}`,
        title: t(m.name, "en"),
        subtitle: `${en.catalog.menuCategory[m.category as keyof typeof en.catalog.menuCategory] ?? m.category} · ${m._count.items} items`,
        live: m.publicVisible,
        liveLabel: "On website",
        warning: m._count.items ? undefined : "No items",
      }))}
    />
  );
}
