import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/crm/page-header";
import { db } from "@/lib/db";
import { t, type Localized } from "@/lib/i18n/localized";
import { cloudinaryConfigured, mediaOptions } from "@/server/services/media";

import { BlogEditor } from "./blog-editor";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Edit blog post" };

export default async function EditBlogPostPage({ params }: PageProps<"/admin/cms/blog/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const [post, cover, categories, media] = await Promise.all([
    isNew ? null : db.blogPost.findUnique({ where: { id } }),
    isNew ? null : db.mediaPlacement.findFirst({ where: { ownerType: "blog_post", ownerId: id }, orderBy: { sortOrder: "asc" } }),
    db.blogCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    mediaOptions("IMAGE"),
  ]);
  if (!isNew && !post) notFound();
  const title = post ? t(post.title, "en") : "New blog post";
  return (
    <>
      <PageHeader title={title} crumbs={[{ label: "Website CMS", href: "/admin/cms/pages" }, { label: "Blog", href: "/admin/cms/blog" }, { label: title }]} />
      <BlogEditor
        id={post?.id ?? null}
        media={media}
        uploads={cloudinaryConfigured()}
        categories={categories.map((c) => ({ value: c.key, label: t(c.name, "en") }))}
        defaults={{
          title: (post?.title as Localized | undefined) ?? null,
          slug: post?.slug ?? "",
          summary: (post?.summary as Localized | null | undefined) ?? null,
          content: (post?.content as Localized | undefined) ?? null,
          coverAssetId: cover?.assetId ?? null,
          categoryKey: post?.categoryKey ?? categories[0]?.key ?? "",
          tags: Array.isArray(post?.tags) ? (post.tags as string[]).join(", ") : "",
          author: post?.author ?? "The Sundaram Palace Team",
          seoTitle: (post?.metaTitle as Localized | null | undefined) ?? null,
          seoDescription: (post?.metaDescription as Localized | null | undefined) ?? null,
          published: post?.published ?? false,
        }}
      />
    </>
  );
}
