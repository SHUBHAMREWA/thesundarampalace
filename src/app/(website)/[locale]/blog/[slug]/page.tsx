import { Calendar, ChevronRight, Clock, User } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BlogCard } from "@/components/website/blog-card";
import { CmsImage } from "@/components/website/cms-image";
import { JsonLd } from "@/components/website/json-ld";
import { ShareButtons } from "@/components/website/share-buttons";
import { currentLocale } from "@/i18n/current";
import { Link } from "@/i18n/navigation";
import { excerpt, readingMinutes } from "@/lib/content/excerpt";
import { RichText } from "@/lib/content/rich-text";
import { env } from "@/lib/env";
import { t } from "@/lib/i18n/localized";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { pageMetadata } from "@/lib/seo/metadata";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/seo/structured-data";
import { BLOG_RSS_URL } from "@/lib/seo/metadata";
import { formatDateKey } from "@/lib/time";
import { getBlogPost, getPublicContact, listBlogPosts } from "@/server/cms/queries";

/** Build-time placeholder so the route has a static shell before the first post exists. */
const NO_POSTS_YET = "coming-soon";

export async function generateStaticParams() {
  const posts = await listBlogPosts().catch(() => []);
  return posts.length ? posts.map((p) => ({ slug: p.slug })) : [{ slug: NO_POSTS_YET }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await currentLocale();
  const post = await getBlogPost(slug);
  if (!post) return { robots: { index: false, follow: true } };
  const base = pageMetadata({
    locale,
    path: `/blog/${slug}`,
    title: t(post.seo.title, locale) || t(post.title, locale),
    description: t(post.seo.description, locale) || t(post.summary, locale) || excerpt(t(post.content, locale)),
    imageUrl: post.cover ? cloudinaryImageUrl(post.cover.publicId, 1200) : undefined,
    imageAlt: post.cover ? t(post.cover.alt, locale) : undefined,
    type: "article",
    // Without its own Hindi text, only the English page is offered to search engines.
    locales: post.hindi ? undefined : ["en"],
  });
  return {
    ...base,
    alternates: { ...base.alternates, types: { "application/rss+xml": BLOG_RSS_URL } },
    openGraph: {
      ...base.openGraph,
      type: "article",
      ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
      modifiedTime: post.updatedAt,
      authors: [post.author],
      tags: post.tags,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/[locale]/blog/[slug]">) {
  const { slug } = await params;
  const locale = await currentLocale();
  const [post, contact, all] = await Promise.all([getBlogPost(slug), getPublicContact(), listBlogPosts()]);
  if (!post) notFound();
  // "More articles": the same category first, then the newest others.
  const others = all.filter((p) => p.slug !== post.slug);
  const related = [
    ...others.filter((p) => p.category.key === post.category.key),
    ...others.filter((p) => p.category.key !== post.category.key),
  ].slice(0, 3);

  const isHindi = locale === "hi";
  const title = t(post.title, locale);
  const summary = t(post.summary, locale);
  const minutes = readingMinutes(t(post.content, locale));
  const site = env().NEXT_PUBLIC_SITE_URL;
  const pageUrl = `${site}/${post.hindi ? locale : "en"}/blog/${post.slug}`;
  const crumbs = [
    { name: isHindi ? "होम" : "Home", href: "/", url: `${site}/${locale}` },
    { name: isHindi ? "ब्लॉग" : "Blog", href: "/blog", url: `${site}/${locale}/blog` },
    { name: title, href: null, url: pageUrl },
  ];

  return (
    <article className="py-16 md:py-24">
      <JsonLd
        data={articleJsonLd({
          url: pageUrl,
          headline: t(post.seo.title, locale) || title,
          description: t(post.seo.description, locale) || summary || excerpt(t(post.content, locale)),
          imageUrl: post.cover ? cloudinaryImageUrl(post.cover.publicId, 1200) : null,
          author: post.author,
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          publisherName: contact.displayName,
          publisherLogo: `${site}/icon-512.png`,
          inLanguage: isHindi ? "hi-IN" : "en-IN",
        })}
      />
      <JsonLd data={breadcrumbJsonLd(crumbs.map(({ name, url }) => ({ name, url })))} />
      <Container className="max-w-3xl">
        <nav aria-label={isHindi ? "आप यहाँ हैं" : "Breadcrumb"} className="mb-6 text-sm text-text-muted">
          <ol className="flex flex-wrap items-center gap-1.5">
            {crumbs.map((c, i) => (
              <li key={c.url} className="flex items-center gap-1.5">
                {i > 0 ? <ChevronRight className="size-3.5" aria-hidden="true" /> : null}
                {c.href ? (
                  <Link href={c.href} className="hover:text-primary hover:underline">
                    {c.name}
                  </Link>
                ) : (
                  <span aria-current="page" className="line-clamp-1 text-text">
                    {c.name}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <header className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
            <Badge variant="outline">{t(post.category.name, locale)}</Badge>
            {post.publishedAt && post.publishedOn ? (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" aria-hidden="true" />
                <time dateTime={post.publishedAt}>{formatDateKey(post.publishedOn, "d MMMM yyyy")}</time>
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <User className="size-3" aria-hidden="true" />
              {post.author}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" aria-hidden="true" />
              {isHindi ? `${minutes} मिनट` : `${minutes} min read`}
            </span>
          </div>
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
          {summary ? <p className="border-l-2 border-primary/40 pl-4 text-lg text-text-muted">{summary}</p> : null}
        </header>
        {post.cover ? (
          <CmsImage media={post.cover} locale={locale} sizes="(min-width: 768px) 768px, 100vw" priority className="mt-8 aspect-[16/9] rounded-lg" />
        ) : null}
        <div className="mt-8 border-t border-border pt-8">
          <RichText source={t(post.content, locale)} />
        </div>
        {post.tags.length ? (
          <ul className="mt-8 flex flex-wrap gap-2" aria-label={isHindi ? "टैग" : "Tags"}>
            {post.tags.map((tag) => (
              <li key={tag}>
                <Badge variant="secondary">{tag}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-8 border-t border-border pt-6">
          <ShareButtons url={pageUrl} title={title} locale={locale} />
        </div>
        <aside className="mt-12 space-y-4 rounded-lg border border-border bg-blush p-8 text-center">
          <h2 className="font-display text-xl">{isHindi ? "अपने उत्सव की योजना बनाएं" : "Planning a celebration?"}</h2>
          <p className="mx-auto max-w-lg text-sm text-text-muted">
            {isHindi ? "अपनी तारीख और ज़रूरतें बताएं, हमारी टीम आपसे संपर्क करेगी।" : "Tell us your date and what you have in mind, and our team will get in touch."}
          </p>
          <Button asChild>
            <Link href="/plan-your-event">{isHindi ? "कार्यक्रम की योजना बनाएं" : "Plan your event"}</Link>
          </Button>
        </aside>
      </Container>
      {related.length ? (
        <Container className="mt-16">
          <h2 className="mb-6 font-display text-2xl">{isHindi ? "और लेख" : "More articles"}</h2>
          <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <BlogCard key={p.slug} post={p} locale={locale} headingLevel="h3" />
            ))}
          </ul>
        </Container>
      ) : null}
    </article>
  );
}
