import { BookOpen } from "lucide-react";
import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { BlogCard } from "@/components/website/blog-card";
import { PageHero } from "@/components/website/page-hero";
import { currentLocale } from "@/i18n/current";
import { BLOG_RSS_URL, pageMetadata } from "@/lib/seo/metadata";
import { listBlogPosts } from "@/server/cms/queries";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const meta = pageMetadata({
    locale,
    path: "/blog",
    title: locale === "hi" ? "ब्लॉग — विवाह योजना और विचार" : "Blog — wedding planning ideas and guides",
    description:
      locale === "hi"
        ? "विवाह और उत्सवों की योजना, सजावट और भोजन के लिए उपयोगी लेख।"
        : "Planning tips, décor ideas, food and traditions for weddings and celebrations.",
  });
  return {
    ...meta,
    alternates: { ...meta.alternates, types: { "application/rss+xml": BLOG_RSS_URL } },
  };
}

export default async function BlogListingPage() {
  const locale = await currentLocale();
  const posts = await listBlogPosts();
  const isHindi = locale === "hi";

  return (
    <>
      <PageHero
        title={isHindi ? "ब्लॉग" : "Blog"}
        summary={isHindi ? "विवाह और उत्सवों की योजना के लिए विचार और मार्गदर्शिकाएं।" : "Ideas and guides for planning weddings and celebrations."}
        locale={locale}
      />
      <section className="py-16 md:py-24">
        <Container>
          {posts.length ? (
            <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <BlogCard key={post.slug} post={post} locale={locale} />
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center">
              <BookOpen className="mx-auto mb-3 size-10 text-text-muted" aria-hidden="true" />
              <h2 className="font-display text-lg">{isHindi ? "जल्द ही नए लेख" : "New articles coming soon"}</h2>
            </div>
          )}
        </Container>
      </section>
    </>
  );
}
