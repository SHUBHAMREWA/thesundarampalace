import { env } from "@/lib/env";
import { t } from "@/lib/i18n/localized";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { SITE_NAME } from "@/lib/seo/metadata";
import { listBlogPosts } from "@/server/cms/queries";

const xml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * RSS feed of the blog (English), newest first, for feed readers and tools.
 * Built with the site and refreshed with the CMS like the sitemap.
 */
export async function GET() {
  const site = env().NEXT_PUBLIC_SITE_URL;
  const posts = await listBlogPosts();
  const items = posts
    .map((post) => {
      const url = `${site}/en/blog/${post.slug}`;
      const summary = t(post.summary, "en");
      return [
        "<item>",
        `<title>${xml(t(post.title, "en"))}</title>`,
        `<link>${url}</link>`,
        `<guid isPermaLink="true">${url}</guid>`,
        summary ? `<description>${xml(summary)}</description>` : "",
        `<category>${xml(t(post.category.name, "en"))}</category>`,
        post.publishedAt ? `<pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>` : "",
        post.cover
          ? `<enclosure url="${xml(cloudinaryImageUrl(post.cover.publicId, 1200))}" type="image/jpeg" length="0"/>`
          : "",
        "</item>",
      ].join("");
    })
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${xml(SITE_NAME)} — Blog</title>
<link>${site}/en/blog</link>
<description>Ideas and guides for planning weddings and celebrations.</description>
<language>en-IN</language>
<atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`;
  return new Response(body, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
