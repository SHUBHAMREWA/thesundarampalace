import { Newspaper } from "lucide-react";
import type { Metadata } from "next";

import { SimpleCmsList } from "@/components/cms/simple-list";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { formatIST } from "@/lib/time";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Blog" };

export default async function BlogAdminPage() {
  const [posts, covers] = await Promise.all([
    db.blogPost.findMany({ orderBy: [{ published: "asc" }, { publishedAt: "desc" }, { updatedAt: "desc" }], include: { category: true } }),
    db.mediaPlacement.findMany({ where: { ownerType: "blog_post" }, select: { ownerId: true } }),
  ]);
  const withCover = new Set(covers.map((c) => c.ownerId));
  return (
    <SimpleCmsList
      title="Blog"
      description="Articles that help couples plan, and help the website rank on Google. Drafts stay hidden until published."
      newHref="/admin/cms/blog/new"
      newLabel="Write a post"
      icon={Newspaper}
      emptyText="No posts yet"
      items={posts.map((post) => ({
        id: post.id,
        href: `/admin/cms/blog/${post.id}`,
        title: t(post.title, "en"),
        subtitle: [`/blog/${post.slug}`, t(post.category.name, "en"), post.publishedAt ? `published ${formatIST(post.publishedAt, "d MMM yyyy")}` : null].filter(Boolean).join(" · "),
        live: post.published,
        warning: withCover.has(post.id) ? undefined : "No cover photo",
      }))}
    />
  );
}
