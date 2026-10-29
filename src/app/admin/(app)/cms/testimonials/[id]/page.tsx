import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/crm/page-header";
import { db } from "@/lib/db";
import type { Localized } from "@/lib/i18n/localized";
import { cloudinaryConfigured, mediaOptions } from "@/server/services/media";

import { TestimonialEditor } from "./testimonial-editor";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Edit testimonial" };

export default async function EditTestimonialPage({ params }: PageProps<"/admin/cms/testimonials/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const [row, media, placement] = await Promise.all([
    isNew ? null : db.testimonial.findUnique({ where: { id } }),
    mediaOptions("IMAGE"),
    isNew ? null : db.mediaPlacement.findFirst({ where: { ownerType: "testimonial", ownerId: id } }),
  ]);
  if (!isNew && !row) notFound();
  const title = row?.name ?? "New testimonial";
  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: "Website CMS", href: "/admin/cms/pages" }, { label: "Testimonials", href: "/admin/cms/testimonials" }, { label: title }]}
      />
      <TestimonialEditor
        id={row?.id ?? null}
        media={media}
        uploads={cloudinaryConfigured()}
        defaults={{
          name: row?.name ?? "",
          event: (row?.event as Localized | null) ?? null,
          quote: (row?.quote as Localized | undefined) ?? null,
          rating: row?.rating ?? 5,
          photoAssetId: placement?.assetId ?? null,
          consent: row?.consent ?? false,
          published: row?.published ?? false,
        }}
      />
    </>
  );
}
