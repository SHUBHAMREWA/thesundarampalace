import "server-only";

import { z } from "zod";

import { MEDIA_GROUPS } from "@/lib/content/catalog";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { HERO_VIDEO_EAGER } from "@/lib/media/cloudinary";
import { localizedOptional, localizedRequired } from "@/lib/i18n/localized";
import { assertPermission, type Actor } from "@/server/policies/authorize";
import {
  ALLOWED_FORMATS,
  buildUploadSignature,
  signParams,
  verifyUploadResponse,
} from "@/server/media/cloudinary-sign";

import { recordAudit } from "./audit";

export function cloudinaryConfigured(): boolean {
  const e = env();
  return Boolean(
    e.CLOUDINARY_CLOUD_NAME &&
    e.CLOUDINARY_API_KEY &&
    e.CLOUDINARY_API_SECRET &&
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  );
}

function folderFor(group: string): string {
  const prefix = (process.env.CLOUDINARY_FOLDER_PREFIX || "dev").replace(
    /[^a-z0-9_-]/gi,
    "",
  );
  return `sundaram/${prefix}/${group}`;
}

/** Short-lived signature for one browser-to-Cloudinary upload (videos also get their hero sizes pre-built). */
export function uploadSignature(
  actor: Actor,
  group: string,
  kind: "video" | "other" = "other",
) {
  assertPermission(actor, "cms.edit");
  if (!cloudinaryConfigured()) throw new Error("Cloudinary is not configured");
  const g = z.enum(MEDIA_GROUPS).parse(group);
  const e = env();
  const signed = buildUploadSignature(
    {
      folder: folderFor(g),
      timestamp: Math.floor(Date.now() / 1000),
      eager: kind === "video" ? HERO_VIDEO_EAGER : undefined,
    },
    e.CLOUDINARY_API_SECRET!,
  );
  return {
    ...signed,
    apiKey: e.CLOUDINARY_API_KEY!,
    cloudName: e.CLOUDINARY_CLOUD_NAME!,
  };
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
  photographerCredit: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  usagePermission: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : null)),
});

const MAX_BYTES = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  raw: 15 * 1024 * 1024,
} as const;

type SignedUpload = z.infer<typeof registerSchema>["upload"];

/** Checks Cloudinary's own signature on an upload response, its format and size. */
function assertVerifiedUpload(upload: SignedUpload) {
  const secret = env().CLOUDINARY_API_SECRET;
  if (!secret || !verifyUploadResponse(upload, secret)) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["form"],
        message: "The upload could not be verified. Please try again.",
        input: null,
      },
    ]);
  }
  if (
    upload.format &&
    !(ALLOWED_FORMATS as readonly string[]).includes(
      upload.format.toLowerCase(),
    )
  ) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["file"],
        message: "This file type is not allowed",
        input: upload.format,
      },
    ]);
  }
  if (upload.bytes && upload.bytes > MAX_BYTES[upload.resource_type]) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["file"],
        message: "The file is larger than allowed",
        input: upload.bytes,
      },
    ]);
  }
}

/**
 * Deletes a file (image, video or PDF) from Cloudinary and purges its CDN
 * copies, so the old file stops loading straight away. False when Cloudinary
 * is not set up or did not delete it.
 */
async function destroyInCloudinary(
  publicId: string,
  resourceType: string,
): Promise<boolean> {
  if (!cloudinaryConfigured()) return false;
  const e = env();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: "true", public_id: publicId, timestamp };
  const body = new URLSearchParams({
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ),
    api_key: e.CLOUDINARY_API_KEY!,
    signature: signParams(params, e.CLOUDINARY_API_SECRET!),
  });
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${e.CLOUDINARY_CLOUD_NAME}/${resourceType}/destroy`,
    { method: "POST", body, signal: AbortSignal.timeout(10_000) },
  ).catch(() => null);
  if (!response?.ok) return false;
  // Cloudinary answers 200 with { result: "not found" } when nothing was deleted.
  const result = (await response.json().catch(() => null)) as {
    result?: string;
  } | null;
  return result?.result === "ok";
}

/** Records an upload after checking Cloudinary's own signature on the response. */
export async function registerUploadedAsset(
  actor: Actor,
  input: z.infer<typeof registerSchema>,
) {
  assertPermission(actor, "cms.edit");
  assertVerifiedUpload(input.upload);
  const { upload } = input;
  const asset = await db.mediaAsset.create({
    data: {
      publicId: upload.public_id,
      resourceType: upload.resource_type,
      format: upload.format ?? null,
      kind:
        upload.resource_type === "image"
          ? "IMAGE"
          : upload.resource_type === "video"
            ? "VIDEO"
            : "DOCUMENT",
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
  await recordAudit({
    actorId: actor.id,
    action: "media.uploaded",
    entityType: "media_asset",
    entityId: asset.id,
    summary: { publicId: asset.publicId },
  });
  return asset;
}

export const assetMetaSchema = z.object({
  alt: localizedRequired,
  caption: localizedOptional,
  photographerCredit: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  usagePermission: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : null)),
  group: z.enum(MEDIA_GROUPS),
});

export async function updateAssetMeta(
  actor: Actor,
  id: string,
  input: z.infer<typeof assetMetaSchema>,
) {
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
  const [placements, gallery, pages, sections] = await Promise.all([
    db.mediaPlacement.count({ where: { assetId: id } }),
    db.galleryItem.count({ where: { assetId: id } }),
    db.websitePage.count({ where: { heroAssetId: id } }),
    db.homeSection.count({
      where: {
        OR: [
          { content: { path: ["posterAssetId"], equals: id } },
          { content: { path: ["videoAssetId"], equals: id } },
          { content: { path: ["slideAssetIds"], array_contains: [id] } },
          { content: { path: ["pictureAssetIds"], array_contains: [id] } },
        ],
      },
    }),
  ]);
  return placements + gallery + pages + sections;
}

/** Takes an asset off every venue, décor theme, celebration, gallery, page header and homepage section. */
async function detachEverywhere(tx: Prisma.TransactionClient, id: string) {
  await tx.mediaPlacement.deleteMany({ where: { assetId: id } });
  await tx.galleryItem.deleteMany({ where: { assetId: id } });
  await tx.websitePage.updateMany({
    where: { heroAssetId: id },
    data: { heroAssetId: null },
  });
  for (const section of await tx.homeSection.findMany()) {
    const content = { ...(section.content as Record<string, unknown>) };
    let changed = false;
    for (const key of ["posterAssetId", "videoAssetId"]) {
      if (content[key] === id) {
        content[key] = null;
        changed = true;
      }
    }
    for (const key of ["slideAssetIds", "pictureAssetIds"]) {
      const list = content[key];
      if (Array.isArray(list) && list.includes(id)) {
        content[key] = list.filter((v) => v !== id);
        changed = true;
      }
    }
    if (changed)
      await tx.homeSection.update({
        where: { type: section.type },
        data: { content: content as Prisma.InputJsonValue },
      });
  }
}

/**
 * Deletes a file from the library and from Cloudinary. By default a file still
 * used on the website is refused; with `everywhere` (the delete button inside
 * a photo picker) it is first taken off every page that uses it.
 */
export async function deleteAsset(
  actor: Actor,
  id: string,
  options: { everywhere?: boolean } = {},
): Promise<{ removedFromCloudinary: boolean }> {
  assertPermission(actor, "cms.publish");
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
  if (!options.everywhere && (await assetUsage(id)) > 0) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["form"],
        message:
          "This file is still used on the website. Remove it from those pages first.",
        input: id,
      },
    ]);
  }
  const removedFromCloudinary = await destroyInCloudinary(
    asset.publicId,
    asset.resourceType,
  );
  await db.$transaction(async (tx) => {
    if (options.everywhere) await detachEverywhere(tx, id);
    await tx.mediaAsset.delete({ where: { id } });
  });
  await recordAudit({
    actorId: actor.id,
    action: "media.deleted",
    entityType: "media_asset",
    entityId: id,
    summary: { publicId: asset.publicId, removedFromCloudinary },
  });
  return { removedFromCloudinary };
}

export const replaceSchema = z.object({ upload: registerSchema.shape.upload });

/**
 * Swaps the file behind an asset for a newly uploaded one. The asset keeps its
 * id, so every page using it shows the new file; the old file is then deleted
 * from Cloudinary.
 */
export async function replaceAssetFile(
  actor: Actor,
  id: string,
  input: z.infer<typeof replaceSchema>,
): Promise<{ removedOld: boolean }> {
  assertPermission(actor, "cms.edit");
  const asset = await db.mediaAsset.findUniqueOrThrow({ where: { id } });
  const { upload } = input;
  assertVerifiedUpload(upload);
  if (upload.resource_type !== asset.resourceType) {
    await destroyInCloudinary(upload.public_id, upload.resource_type);
    throw new z.ZodError([
      {
        code: "custom",
        path: ["file"],
        message: `Replace a ${asset.resourceType} with another ${asset.resourceType}`,
        input: upload.resource_type,
      },
    ]);
  }
  await db.mediaAsset.update({
    where: { id },
    data: {
      publicId: upload.public_id,
      format: upload.format ?? null,
      width: upload.width ?? null,
      height: upload.height ?? null,
      bytes: upload.bytes ?? null,
    },
  });
  const removedOld =
    upload.public_id === asset.publicId
      ? true
      : await destroyInCloudinary(asset.publicId, asset.resourceType);
  await recordAudit({
    actorId: actor.id,
    action: "media.replaced",
    entityType: "media_asset",
    entityId: id,
    summary: {
      oldPublicId: asset.publicId,
      newPublicId: upload.public_id,
      removedOld,
    },
  });
  return { removedOld };
}

export type MediaOption = {
  id: string;
  label: string;
  publicId: string;
  resourceType: string;
  group: string;
};

export async function mediaOptions(
  kind?: "IMAGE" | "VIDEO",
): Promise<MediaOption[]> {
  const rows = await db.mediaAsset.findMany({
    where: kind ? { kind } : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      alt: true,
      publicId: true,
      resourceType: true,
      group: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    label: (r.alt as { en?: string }).en || r.publicId,
    publicId: r.publicId,
    resourceType: r.resourceType,
    group: r.group,
  }));
}
