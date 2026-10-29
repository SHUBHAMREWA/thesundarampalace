import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { localizedOptional, localizedRequired } from "@/lib/i18n/localized";
import { assertPermission, can, ForbiddenError, type Actor } from "@/server/policies/authorize";

import { recordAudit } from "./audit";
import { slugify, slugSchema } from "./cms";
import { NotFoundError } from "./leads";

/**
 * Blog posts (Website CMS → Blog). Writes need `cms.edit`; publishing or
 * unpublishing also needs `cms.publish`. Public reads live in
 * src/server/cms/queries.ts; callers refresh them with updateTag("cms").
 */

export const blogPostSchema = z
  .object({
    title: localizedRequired,
    /** Empty means "make one from the English title". */
    slug: z.string().trim().max(80).optional().default(""),
    summary: localizedOptional,
    content: localizedRequired,
    coverAssetId: z.string().max(50).optional().transform((v) => (v ? v : null)),
    categoryKey: z.string().trim().min(1, "Choose a category").max(50),
    tags: z
      .string()
      .max(500)
      .optional()
      .transform((v) => [...new Set((v ?? "").split(",").map((tag) => tag.trim()).filter(Boolean))].slice(0, 15)),
    author: z.string().trim().max(120).optional().transform((v) => v || "The Sundaram Palace Team"),
    seoTitle: localizedOptional,
    seoDescription: localizedOptional,
    published: z.boolean(),
  })
  .transform((v, ctx) => {
    const slug = slugSchema.safeParse(v.slug || slugify(v.title.en));
    if (!slug.success) {
      ctx.addIssue({ code: "custom", path: ["slug"], message: slug.error.issues[0]?.message ?? "Enter a web address" });
      return z.NEVER;
    }
    return { ...v, slug: slug.data, autoSlug: !v.slug };
  });

export type BlogPostInput = z.infer<typeof blogPostSchema>;

const jsonOrNull = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));

async function freeSlug(base: string, id: string | null): Promise<string> {
  for (let n = 1; n < 100; n += 1) {
    const slug = n === 1 ? base : `${base.slice(0, 76)}-${n}`;
    const owner = await db.blogPost.findUnique({ where: { slug }, select: { id: true } });
    if (!owner || owner.id === id) return slug;
  }
  return base;
}

export async function saveBlogPost(actor: Actor, id: string | null, input: BlogPostInput): Promise<string> {
  assertPermission(actor, "cms.edit");
  const existing = id ? await db.blogPost.findUnique({ where: { id } }) : null;
  if (id && !existing) throw new NotFoundError("Blog post");
  if ((existing?.published ?? false) !== input.published && !can(actor, "cms.publish")) throw new ForbiddenError("cms.publish");
  // An address made from the title gets "-2", "-3"… when another post has it; a typed one must be unique.
  if (input.autoSlug) input = { ...input, slug: await freeSlug(input.slug, id) };
  const owner = await db.blogPost.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (owner && owner.id !== id) throw new z.ZodError([{ code: "custom", path: ["slug"], message: "Another post uses this web address", input: input.slug }]);
  if (!(await db.blogCategory.findUnique({ where: { key: input.categoryKey } }))) {
    throw new z.ZodError([{ code: "custom", path: ["categoryKey"], message: "Choose a category", input: input.categoryKey }]);
  }
  if (input.coverAssetId && !(await db.mediaAsset.findFirst({ where: { id: input.coverAssetId, kind: "IMAGE" } }))) {
    throw new z.ZodError([{ code: "custom", path: ["coverAssetId"], message: "Choose an image from the media library", input: input.coverAssetId }]);
  }

  const data = {
    slug: input.slug,
    title: input.title as Prisma.InputJsonValue,
    summary: jsonOrNull(input.summary),
    content: input.content as Prisma.InputJsonValue,
    author: input.author,
    categoryKey: input.categoryKey,
    tags: input.tags,
    published: input.published,
    // The first publication date stays, so re-saving never makes a post look new.
    publishedAt: existing?.publishedAt ?? (input.published ? new Date() : null),
    metaTitle: jsonOrNull(input.seoTitle),
    metaDescription: jsonOrNull(input.seoDescription),
  };
  const postId = await db.$transaction(async (tx) => {
    const post = id ? await tx.blogPost.update({ where: { id }, data }) : await tx.blogPost.create({ data });
    await tx.mediaPlacement.deleteMany({ where: { ownerType: "blog_post", ownerId: post.id } });
    if (input.coverAssetId) await tx.mediaPlacement.create({ data: { ownerType: "blog_post", ownerId: post.id, assetId: input.coverAssetId, sortOrder: 0 } });
    return post.id;
  });
  await recordAudit({
    actorId: actor.id,
    action: id ? "cms.blog.saved" : "cms.blog.created",
    entityType: "blog_post",
    entityId: postId,
    summary: { slug: input.slug, published: input.published },
  });
  return postId;
}

export async function deleteBlogPost(actor: Actor, id: string) {
  assertPermission(actor, "cms.publish");
  const post = await db.blogPost.findUnique({ where: { id } });
  if (!post) throw new NotFoundError("Blog post");
  await db.$transaction([
    db.mediaPlacement.deleteMany({ where: { ownerType: "blog_post", ownerId: id } }),
    db.blogPost.delete({ where: { id } }),
  ]);
  await recordAudit({ actorId: actor.id, action: "cms.blog.deleted", entityType: "blog_post", entityId: id, summary: { slug: post.slug } });
}
