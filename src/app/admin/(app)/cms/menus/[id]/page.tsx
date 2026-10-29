import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/crm/page-header";
import { MENU_COURSES } from "@/lib/content/catalog";
import { db } from "@/lib/db";
import { t, type Localized } from "@/lib/i18n/localized";

import { MenuEditor } from "./menu-editor";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Edit menu" };

const line = (name: Localized, description: Localized | null, lang: "en" | "hi") => {
  const n = lang === "hi" ? name.hi ?? "" : name.en;
  const d = description ? (lang === "hi" ? description.hi ?? "" : description.en) : "";
  return d ? `${n} — ${d}` : n;
};

export default async function EditMenuPage({ params }: PageProps<"/admin/cms/menus/[id]">) {
  const { id } = await params;
  const menu = id === "new" ? null : await db.menu.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (id !== "new" && !menu) notFound();
  const courses = Object.fromEntries(
    MENU_COURSES.map((course) => {
      const items = menu?.items.filter((i) => i.course === course) ?? [];
      return [
        course,
        {
          en: items.map((i) => line(i.name as Localized, i.description as Localized | null, "en")).join("\n"),
          hi: items.map((i) => line(i.name as Localized, i.description as Localized | null, "hi")).join("\n"),
        },
      ];
    }),
  );
  const title = menu ? t(menu.name, "en") : "New menu";
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: "Website CMS", href: "/admin/cms/pages" }, { label: "Menus", href: "/admin/cms/menus" }, { label: title }]} />
      <MenuEditor
        id={menu?.id ?? null}
        defaults={{
          name: (menu?.name as Localized) ?? null,
          category: menu?.category ?? "veg",
          description: (menu?.description as Localized | null) ?? null,
          publicVisible: menu?.publicVisible ?? false,
          sortOrder: menu?.sortOrder ?? 0,
          courses,
        }}
      />
    </>
  );
}
