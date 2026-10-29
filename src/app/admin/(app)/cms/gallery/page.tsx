import type { Metadata } from "next";

import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { cloudinaryConfigured } from "@/server/services/media";

import {
  AddToGalleryForm,
  DeleteCategoryButton,
  GalleryPhoto,
} from "./gallery-forms";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Gallery" };

export default async function GalleryAdminPage() {
  const [categories, galleryPage] = await Promise.all([
    db.galleryCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        items: { orderBy: { createdAt: "desc" }, include: { asset: true } },
      },
    }),
    db.websitePage.findUnique({
      where: { kind_slug: { kind: "STANDARD", slug: "gallery" } },
      select: { id: true },
    }),
  ]);
  const options = categories.map((c) => ({
    value: c.id,
    label: t(c.name, "en"),
  }));
  return (
    <>
      <PageHeader
        title="Gallery"
        description="Photos on the Gallery page, grouped by category. Each photo's title shows when visitors hover over it. Newest photos come first; the homepage shows the newest 8."
        actions={
          galleryPage ? (
            <Button asChild variant="outline">
              <Link href={`/admin/cms/pages/${galleryPage.id}`}>
                Page header and intro
              </Link>
            </Button>
          ) : null
        }
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add photos</CardTitle>
        </CardHeader>
        <CardContent>
          <AddToGalleryForm
            categories={options}
            uploads={cloudinaryConfigured()}
          />
        </CardContent>
      </Card>
      <div className="space-y-6">
        {categories.map((category) => (
          <Card key={category.id}>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>
                {t(category.name, "en")}{" "}
                <span className="font-normal text-text-muted">
                  ({category.items.length})
                </span>
              </CardTitle>
              {category.items.length ? null : (
                <DeleteCategoryButton
                  id={category.id}
                  name={t(category.name, "en")}
                />
              )}
            </CardHeader>
            <CardContent>
              {category.items.length ? (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {category.items.map((item) => (
                    <GalleryPhoto
                      key={item.id}
                      id={item.id}
                      publicId={item.asset.publicId}
                      title={
                        (item.asset.caption as { en?: string } | null)?.en ?? ""
                      }
                      categoryId={category.id}
                      categories={options}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">
                  No photos yet. Empty categories are not shown on the website.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
