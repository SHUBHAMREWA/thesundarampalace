import { afterAll, beforeAll, expect, it, vi } from "vitest";

// Public reads use Next's cache directives; outside Next they are plain functions.
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {} }));

import { db } from "@/lib/db";
import type { PermissionKey } from "@/lib/permissions/registry";
import { ForbiddenError, type Actor } from "@/server/policies/authorize";
import { getBlogPost, listBlogPosts } from "@/server/cms/queries";
import { blogPostSchema, deleteBlogPost, saveBlogPost } from "@/server/services/blog";

import { seedCms } from "../../prisma/seed-lib";
import { describeDb } from "./helpers";

const actor = (permissions: PermissionKey[]): Actor => ({ id: "blog-test-actor", permissions: new Set(permissions) });
const editor = actor(["cms.edit"]);
const publisher = actor(["cms.edit", "cms.publish"]);

const input = (over: Record<string, unknown> = {}) =>
  blogPostSchema.parse({
    title: { en: "Sample: planning a sangeet night", hi: "" },
    slug: "",
    summary: { en: "Sample summary for the list.", hi: "" },
    content: { en: "## Sample heading\n\nSample paragraph.", hi: "" },
    coverAssetId: "",
    categoryKey: "wedding-planning",
    tags: "sangeet, planning, sangeet",
    author: "",
    seoTitle: { en: "", hi: "" },
    seoDescription: { en: "Sample SEO description", hi: "" },
    published: false,
    ...over,
  });

describeDb("blog posts (Website CMS → Blog)", () => {
  beforeAll(async () => {
    await seedCms(db);
  });

  afterAll(async () => {
    await db.blogPost.deleteMany({ where: { slug: { startsWith: "sample-" } } });
    await db.$disconnect();
  });

  it("makes the web address from the title and cleans up tags", () => {
    const parsed = input();
    expect(parsed.slug).toBe("sample-planning-a-sangeet-night");
    expect(parsed.tags).toEqual(["sangeet", "planning"]);
    expect(parsed.author).toBe("The Sundaram Palace Team");
    expect(parsed.seoTitle).toBeNull();
    expect(() => input({ slug: "Not A Slug!" })).toThrow();
  });

  it("drafts stay hidden; publishing shows the post and keeps its first publication date", async () => {
    const id = await saveBlogPost(editor, null, input());
    expect((await listBlogPosts()).some((p) => p.slug === "sample-planning-a-sangeet-night")).toBe(false);
    expect(await getBlogPost("sample-planning-a-sangeet-night")).toBeNull();

    // Editors can write but not publish.
    await expect(saveBlogPost(editor, id, input({ published: true }))).rejects.toBeInstanceOf(ForbiddenError);

    await saveBlogPost(publisher, id, input({ published: true }));
    const first = (await db.blogPost.findUniqueOrThrow({ where: { id } })).publishedAt;
    expect(first).not.toBeNull();

    const post = await getBlogPost("sample-planning-a-sangeet-night");
    expect(post?.title.en).toBe("Sample: planning a sangeet night");
    expect(post?.seo.description?.en).toBe("Sample SEO description");
    expect(post?.category.key).toBe("wedding-planning");
    expect(post?.cover).toBeNull();

    await saveBlogPost(publisher, id, input({ published: true, title: { en: "Sample: planning a sangeet night (updated)", hi: "" }, slug: "sample-planning-a-sangeet-night" }));
    expect((await db.blogPost.findUniqueOrThrow({ where: { id } })).publishedAt?.getTime()).toBe(first!.getTime());
  });

  it("refuses a duplicate web address and an unknown category", async () => {
    await expect(saveBlogPost(publisher, null, input({ slug: "sample-planning-a-sangeet-night" }))).rejects.toThrow(/Another post uses this web address/);
    await expect(saveBlogPost(publisher, null, input({ slug: "sample-other", categoryKey: "no-such-category" }))).rejects.toThrow(/Choose a category/);
  });

  it("only publishers can delete, and deleted posts leave the website", async () => {
    const id = await saveBlogPost(publisher, null, input({ slug: "sample-to-delete", published: true }));
    expect(await getBlogPost("sample-to-delete")).not.toBeNull();
    await expect(deleteBlogPost(editor, id)).rejects.toBeInstanceOf(ForbiddenError);
    await deleteBlogPost(publisher, id);
    expect(await getBlogPost("sample-to-delete")).toBeNull();
  });
});
