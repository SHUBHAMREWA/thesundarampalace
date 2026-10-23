import { Gift } from "lucide-react";
import type { Metadata } from "next";

import { SimpleCmsList } from "@/components/cms/simple-list";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { formatINR } from "@/lib/money";

export const metadata: Metadata = { title: "Packages" };

export default async function PackagesPage() {
  const packages = await db.package.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <SimpleCmsList
      title="Packages"
      description="Public packages. Prices stay hidden (“Price on request”) unless an administrator turns them on."
      newHref="/admin/cms/packages/new"
      newLabel="Add package"
      icon={Gift}
      emptyText="No packages yet"
      items={packages.map((p) => ({
        id: p.id,
        href: `/admin/cms/packages/${p.id}`,
        title: t(p.name, "en"),
        subtitle: p.showPublicPrice && p.publicPrice ? `Public price ${formatINR(p.publicPrice.toString())}` : "Price on request",
        live: p.published,
      }))}
    />
  );
}
