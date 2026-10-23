import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/crm/page-header";
import { db } from "@/lib/db";
import { t, type Localized } from "@/lib/i18n/localized";
import { lookupOptions } from "@/server/services/lookups";

import { PackageEditor } from "./package-editor";

export const metadata: Metadata = { title: "Edit package" };

export default async function EditPackagePage({ params }: PageProps<"/admin/cms/packages/[id]">) {
  const { id } = await params;
  const [pkg, eventTypes] = await Promise.all([
    id === "new" ? null : db.package.findUnique({ where: { id } }),
    lookupOptions("event_type"),
  ]);
  if (id !== "new" && !pkg) notFound();
  const title = pkg ? t(pkg.name, "en") : "New package";
  const loc = (v: unknown) => (v as Localized | null) ?? null;
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: "Website CMS", href: "/admin/cms/pages" }, { label: "Packages", href: "/admin/cms/packages" }, { label: title }]} />
      <PackageEditor
        id={pkg?.id ?? null}
        eventTypes={eventTypes.map((e) => ({ value: e.value, label: e.label }))}
        defaults={{
          name: loc(pkg?.name),
          slug: pkg?.slug ?? "",
          description: loc(pkg?.description),
          inclusions: loc(pkg?.inclusions),
          addOns: loc(pkg?.addOns),
          terms: loc(pkg?.terms),
          eventTypeKeys: (pkg?.eventTypeKeys as string[]) ?? [],
          publicPrice: pkg?.publicPrice?.toFixed(2) ?? "",
          publicPriceNote: loc(pkg?.publicPriceNote),
          showPublicPrice: pkg?.showPublicPrice ?? false,
          published: pkg?.published ?? false,
          sortOrder: pkg?.sortOrder ?? 0,
        }}
      />
    </>
  );
}
