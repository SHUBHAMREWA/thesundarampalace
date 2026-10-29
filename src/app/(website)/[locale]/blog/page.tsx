import { BookOpen, Calendar } from "lucide-react";
import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { CmsImage } from "@/components/website/cms-image";
import { PageHero } from "@/components/website/page-hero";
import { currentLocale } from "@/i18n/current";
import { Link } from "@/i18n/navigation";
import { t } from "@/lib/i18n/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import { formatDateKey } from "@/lib/time";
import { listBlogPosts } from "@/server/cms/queries";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  return pageMetadata({
    locale,
    path: "/blog",
    title: locale === "hi" ? "ब्लॉग — विवाह योजना और विचार" : "Blog — wedding planning ideas and guides",
    description:
      locale === "hi"
        ? "विवाह और उत्सवों की योजना, सजावट और भोजन के लिए उपयोगी लेख।"
        : "Planning tips, décor ideas, food and traditions for weddings and celebrations.",
  });
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
                <li key={post.slug} className="flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-card">
                  <Link href={`/blog/${post.slug}`} tabIndex={-1} aria-hidden="true">
                    <CmsImage media={post.cover} locale={locale} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" className="aspect-[3/2]" />
                  </Link>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      <Badge variant="outline">{t(post.category.name, locale)}</Badge>
                      {post.publishedAt && post.publishedOn ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" aria-hidden="true" />
                          <time dateTime={post.publishedAt}>{formatDateKey(post.publishedOn, "d MMM yyyy")}</time>
                        </span>
                      ) : null}
                    </div>
                    <h2 className="font-display text-xl leading-snug">
                      <Link href={`/blog/${post.slug}`} className="hover:text-primary">
                        {t(post.title, locale)}
                      </Link>
                    </h2>
                    {post.summary ? <p className="line-clamp-3 text-sm text-text-muted">{t(post.summary, locale)}</p> : null}
                    <Link href={`/blog/${post.slug}`} className="mt-auto text-sm font-semibold text-primary hover:underline">
                      {isHindi ? "पूरा लेख पढ़ें →" : "Read article →"}
                    </Link>
                  </div>
                </li>
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
