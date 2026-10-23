import "server-only";

import { z } from "zod";

import { MEDIA_GROUPS } from "@/lib/content/catalog";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { localizedOptional, localizedRequired } from "@/lib/i18n/localized";
import { assertPermission, type Actor } from "@/server/policies/authorize";
import { ALLOWED_FORMATS, buildUploadSignature, signParams, verifyUploadResponse } from "@/server/media/cloudinary-sign";

import { recordAudit } from "./audit";

export function cloudinaryConfigured(): boolean {
  const e = env();
  return Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET && process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME);
}

function folderFor(group: string): string {
  const prefix = (process.env.CLOUDINARY_FOLDER_PREFIX || "dev").replace(/[^a-z0-9_-]/gi, "");
  return `sundaram/${prefix}/${group}`;
}

/** Short-lived signature for one browser-to-Cloudinary upload. */
export function uploadSignature(actor: Actor, group: string) {
  assertPermission(actor, "cms.edit");
  if (!cloudinaryConfigured()) throw new Error("Cloudinary is not configured");
  const g = z.enum(MEDIA_GROUPS).parse(group);
  const e = env();
  const signed = buildUploadSignature({ folder: folderFor(g), timestamp: Math.floor(Date.now() / 1000) }, e.CLOUDINARY_API_SECRET!);
  return { ...signed, apiKey: e.CLOUDINARY_API_KEY!, cloudName: e.CLOUDINARY_CLOUD_NAME! };
}

export const registerSchema = z.object({
  upload: z.object({
    public_id: z.string().min(1).max(300),
    version: z.union([z.number(), z.string()]),
    signature: z.string().min(10).max(100),
    resource_type: z.enum(["image", "video", "raw"]),
    format: z.string().max(10).optional(),
    width: z.number().int().optional(),
    height: z.number().int().optional(),
    bytes: z.number().int().optional(),
  }),
  group: z.enum(MEDIA_GROUPS),
  alt: localizedRequired,
  caption: localizedOptional,
  photographerCredit: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  usagePermission: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
});

const MAX_BYTES = { image: 10 * 1024 * 1024, video: 50 * 1024 * 1024, raw: 15 * 1024 * 1024 } as const;

/** Records an upload after checking Cloudinary's own signature on the response. */
export async function registerUploadedAsset(actor: Actor, input: z.infer<typeof registerSchema>) {
  assertPermission(actor, "cms.edit");
  const secret = env().CLOUDINARY_API_SECRET;
  if (!secret || !verifyUploadResponse(input.upload, secret)) {
    throw new z.ZodError([{ code: "custom", path: ["form"], message: "The upload could not be verified. Please try again.", input: null }]);
  }
  const { upload } = input;
  if (upload.format && !(ALLOWED_FORMATS as readonly string[]).includes(upload.format.toLowerCase())) {
    throw new z.ZodError([{ code: "custom", path: ["file"], message: "This file type is not allowed", input: upload.format }]);
  }
  if (upload.bytes && upload.bytes > MAX_BYTES[upload.resource_type]) {
    throw new z.ZodError([{ code: "custom", path: ["file"], message: "The file is larger than allowed", input: upload.bytes }]);
  }
  const asset = await db.mediaAsset.create({
    data: {
      publicId: upload.public_id,
      resourceType: upload.resource_type,
      format: upload.format ?? null,
      kind: upload.resource_type === "image" ? "IMAGE" : upload.resource_type === "video" ? "VIDEO" : "DOCUMENT",
      width: upload.width ?? null,
      height: upload.height ?? null,
      bytes: upload.bytes ?? null,
      alt: input.alt,
      caption: input.caption ?? undefined,
      photographerCredit: input.photographerCredit,
      usagePermission: input.usagePermission,
      group: input.group,
      uploadedById: actor.id,
    },
  });
  await recordAudit({ actorId: actor.id, action: "media.uploaded", entityType: "media_asset", entityId: asset.id, summary: { publicId: asset.publicId } });
  return asset;
}

export const assetMetaSchema = z.object({
  alt: localizedRequired,
  caption: localizedOptional,
  photographerCredit: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
  usagePermission: z.string().trim().max(300).optional().transform((v) => (v ? v : null)),
  group: z.enum(MEDIA_GROUPS),
});

export async function updateAssetMeta(actor: Actor, id: string, input: z.infer<typeof assetMetaSchema>) {
  assertPermission(actor, "cms.edit");
  await db.mediaAsset.update({
    where: { id },
    data: {
      alt: input.alt,
      caption: input.caption ?? undefined,
      photographerCredit: input.photographerCredit,
      usagePermission: input.usagePermission,
      group: input.group,
    },
  });
}

/** Where an asset is used; deletion is refused while it is in use. */
export async function assetUsage(id: string): Promise<number> {
  const [placements, gallery, pages, heroes, plans, sections] = await Promise.all([
    db.mediaPlacement.count({ where: { assetId: id } }),
    db.galleryItem.count({ where: { assetId: id } }),
    db.websitePage.count({ where: { heroAssetId: id } }),
    db.hall.count({ where: { heroAssetId: id } }),
    db.hall.count({ where: { floorPlanAssetId: id } }),
    db.homeSection.count({ where: { content: { path: ["posterAssetId"], equals: id } } }),
  ]);
  return placements + gallery + pages + heroes + plans + sections;
}

export async function deleteAsset(actor: Actor, id: string): Promise<{ removedFromCloudinary: boolean }> {
  assertPermission(actor, "cms.publish");
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
  if ((await assetUsage(id)) > 0) {
    throw new z.ZodError([{ code: "custom", path: ["form"], message: "This file is still used on the website. Remove it from those pages first.", input: id }]);
  }
  let removedFromCloudinary = false;
  if (cloudinaryConfigured()) {
    const e = env();
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { public_id: asset.publicId, timestamp };
    const body = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      api_key: e.CLOUDINARY_API_KEY!,
      signature: signParams(params, e.CLOUDINARY_API_SECRET!),
    });
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}/${asset.resourceType}/destroy`,
      { method: "POST", body, signal: AbortSignal.timeout(10_000) },
    ).catch(() => null);
    removedFromCloudinary = Boolean(response?.ok);
  }
  await db.mediaAsset.delete({ where: { id } });
  await recordAudit({ actorId: actor.id, action: "media.deleted", entityType: "media_asset", entityId: id, summary: { publicId: asset.publicId, removedFromCloudinary } });
  return { removedFromCloudinary };
}

export type MediaOption = { id: string; label: string; publicId: string; resourceType: string; group: string };

export async function mediaOptions(kind?: "IMAGE"): Promise<MediaOption[]> {
  const rows = await db.mediaAsset.findMany({
    where: kind ? { kind } : {},
    orderBy: { createdAt: "desc" },
    select: { id: true, alt: true, publicId: true, resourceType: true, group: true },
  });
  return rows.map((r) => ({
    id: r.id,
    label: (r.alt as { en?: string }).en || r.publicId,
    publicId: r.publicId,
    resourceType: r.resourceType,
    group: r.group,
  }));
}
