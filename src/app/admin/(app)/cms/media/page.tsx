import { ImageIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import type { Localized } from "@/lib/i18n/localized";
import { cloudinaryConfigured } from "@/server/services/media";

import { AssetCard, UploadForm } from "./media-forms";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Media library" };

export default async function MediaPage() {
  const assets = await db.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const configured = cloudinaryConfigured();
  return (
    <>
      <PageHeader
        title="Media library"
        description="Photos, floor plans and documents for the website, stored in Cloudinary. Alt text is required for every image."
      />
      <Card className="mb-6">
        <CardHeader><CardTitle>Upload</CardTitle></CardHeader>
        <CardContent>
          {configured ? (
            <UploadForm />
          ) : (
            <Alert>
              <AlertDescription>
                Uploads are switched off until Cloudinary is connected. Set <code>CLOUDINARY_CLOUD_NAME</code>,{" "}
                <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code>, <code>CLOUDINARY_API_KEY</code> and{" "}
                <code>CLOUDINARY_API_SECRET</code> (free Cloudinary account), then reload this page.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      {assets.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <li key={asset.id}>
              <AssetCard
                asset={{
                  id: asset.id,
                  publicId: asset.publicId,
                  resourceType: asset.resourceType,
                  group: asset.group,
                  alt: asset.alt as Localized,
                  caption: (asset.caption as Localized | null) ?? null,
                  photographerCredit: asset.photographerCredit ?? "",
                  usagePermission: asset.usagePermission ?? "",
                  size: asset.width && asset.height ? `${asset.width}×${asset.height}` : null,
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={ImageIcon} title="No files yet" description="Uploaded photos appear here and can be used on any page." />
      )}
    </>
  );
}
