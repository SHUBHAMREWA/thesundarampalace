import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { mediaOptions } from "@/server/services/media";

import { AddToGalleryForm, GalleryItemControls } from "./gallery-forms";

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryAdminPage() {
  const [categories, media] = await Promise.all([
    db.galleryCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: { items: { orderBy: [{ featured: "desc" }, { sortOrder: "asc" }], include: { asset: true } } },
    }),
    mediaOptions("IMAGE"),
  ]);
  return (
    <>
      <PageHeader title="Gallery" description="Photos shown on the Gallery page, by category. Featured photos appear first and on the homepage." />
      <Card className="mb-6">
        <CardHeader><CardTitle>Add photos</CardTitle></CardHeader>
        <CardContent>
          <AddToGalleryForm categories={categories.map((c) => ({ value: c.id, label: t(c.name, "en") }))} media={media} />
        </CardContent>
      </Card>
      <div className="space-y-6">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader><CardTitle>{t(category.name, "en")} ({category.items.length})</CardTitle></CardHeader>
            <CardContent>
              {category.items.length ? (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {category.items.map((item) => (
                    <li key={item.id} className="rounded-md border border-border p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
                      <img src={cloudinaryImageUrl(item.asset.publicId, 320)} alt={t(item.asset.alt, "en")} className="aspect-[4/3] w-full rounded object-cover" />
                      <GalleryItemControls id={item.id} featured={item.featured} sortOrder={item.sortOrder} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">No photos in this category yet.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
