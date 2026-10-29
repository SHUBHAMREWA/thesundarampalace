import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { dateFromKey } from "@/lib/time";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";
import { recordAudit } from "./audit";
import { NotFoundError } from "./leads";

function cms() {
  try {
    cacheTag("cms");
    cacheLife("max");
  } catch {
    // Graceful fallback in test runner outside Next.js compiler
  }
}

export const realWeddingSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  coupleName: z.record(z.string(), z.string()).refine((r) => !!r.en?.trim(), "English couple name is required"),
  eventDate: z.string().trim().optional(),
  eventTypeKey: z.string().trim().default("wedding"),
  hallUsed: z.record(z.string(), z.string()).optional(),
  photographerCredit: z.string().trim().optional(),
  summary: z.record(z.string(), z.string()).optional(),
  story: z.record(z.string(), z.string()).optional(),
  coverImageUrl: z.string().trim().optional(),
  galleryImageUrls: z.array(z.string()).default([]),
  coupleConsent: z.boolean().default(false),
  photographerConsent: z.boolean().default(false),
  published: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

export type RealWeddingInput = z.infer<typeof realWeddingSchema>;

export async function listPublicRealWeddings() {
  "use cache";
  cms();
  // CRITICAL DPDP RULE: Only display stories where couple AND photographer consent is on file.
  return db.realWeddingStory.findMany({
    where: {
      published: true,
      coupleConsent: true,
      photographerConsent: true,
    },
    orderBy: [{ sortOrder: "asc" }, { eventDate: "desc" }],
    select: {
      id: true,
      slug: true,
      coupleName: true,
      eventDate: true,
      eventTypeKey: true,
      hallUsed: true,
      photographerCredit: true,
      summary: true,
      coverImageUrl: true,
    },
  });
}

export async function getPublicRealWedding(slug: string) {
  "use cache";
  cms();
  return db.realWeddingStory.findFirst({
    where: {
      slug,
      published: true,
      coupleConsent: true,
      photographerConsent: true,
    },
    select: {
      id: true,
      slug: true,
      coupleName: true,
      eventDate: true,
      eventTypeKey: true,
      hallUsed: true,
      photographerCredit: true,
      summary: true,
      story: true,
      coverImageUrl: true,
      galleryImageUrls: true,
    },
  });
}

export async function listAdminRealWeddings(actor: Actor) {
  assertPermission(actor, "cms.edit");
  return db.realWeddingStory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function saveRealWedding(actor: Actor, id: string | null, input: RealWeddingInput) {
  assertPermission(actor, "cms.edit");
  if (input.published && !can(actor, "cms.publish")) {
    assertPermission(actor, "cms.publish");
  }

  const now = new Date();
  const consentGiven = input.coupleConsent && input.photographerConsent;

  const data = {
    slug: input.slug,
    coupleName: input.coupleName as Prisma.InputJsonValue,
    eventDate: input.eventDate ? dateFromKey(input.eventDate) : null,
    eventTypeKey: input.eventTypeKey,
    hallUsed: input.hallUsed ? (input.hallUsed as Prisma.InputJsonValue) : Prisma.JsonNull,
    photographerCredit: input.photographerCredit ?? null,
    summary: input.summary ? (input.summary as Prisma.InputJsonValue) : Prisma.JsonNull,
    story: input.story ? (input.story as Prisma.InputJsonValue) : Prisma.JsonNull,
    coverImageUrl: input.coverImageUrl ?? null,
    galleryImageUrls: input.galleryImageUrls,
    coupleConsent: input.coupleConsent,
    photographerConsent: input.photographerConsent,
    consentDate: consentGiven ? now : null,
    // Automatically force unpublish if consent is missing or withdrawn
    published: consentGiven ? input.published : false,
    sortOrder: input.sortOrder,
  };

  const story = id
    ? await db.realWeddingStory.update({ where: { id }, data })
    : await db.realWeddingStory.create({ data });

  await recordAudit({
    actorId: actor.id,
    action: id ? "cms.real_wedding_updated" : "cms.real_wedding_created",
    entityType: "real_wedding_story",
    entityId: story.id,
    summary: { slug: story.slug, published: story.published, consentGiven },
  });

  return story;
}

export async function deleteRealWedding(actor: Actor, id: string) {
  assertPermission(actor, "cms.edit");
  const story = await db.realWeddingStory.findUnique({ where: { id } });
  if (!story) throw new NotFoundError("Real wedding story");

  await db.realWeddingStory.delete({ where: { id } });
  await recordAudit({
    actorId: actor.id,
    action: "cms.real_wedding_deleted",
    entityType: "real_wedding_story",
    entityId: id,
    summary: { slug: story.slug },
  });
}
