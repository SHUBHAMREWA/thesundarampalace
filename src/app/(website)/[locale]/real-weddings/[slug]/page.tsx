import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera, Heart, MapPin } from "lucide-react";
import { currentLocale } from "@/i18n/current";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { RichText } from "@/lib/content/rich-text";
import { t } from "@/lib/i18n/localized";
import { pageMetadata } from "@/lib/seo/metadata";
import { dateKey, formatDateKey } from "@/lib/time";
import {
  getPublicRealWedding,
  listPublicRealWeddings,
} from "@/server/services/real-weddings";

const NO_STORIES_YET = "coming-soon";

export async function generateStaticParams() {
  const stories = await listPublicRealWeddings().catch(() => []);
  return stories.length
    ? stories.map((s) => ({ slug: s.slug }))
    : [{ slug: NO_STORIES_YET }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug, locale } = await params;
  if (slug === NO_STORIES_YET)
    return { title: "Real weddings", robots: { index: false, follow: true } };
  const wedding = await getPublicRealWedding(slug);
  if (!wedding) return { title: "Story Not Found" };

  const loc = locale === "hi" ? "hi" : "en";
  const names = t(wedding.coupleName, loc) || "Wedding Celebration";

  return pageMetadata({
    locale: loc,
    path: `/real-weddings/${slug}`,
    title: names,
    description:
      t(wedding.summary, loc) ||
      `Celebration of ${names} at The Sundaram Palace.`,
    imageUrl: wedding.coverImageUrl || undefined,
    type: "article",
  });
}

export default async function RealWeddingStoryPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const locale = await currentLocale();

  if (slug === NO_STORIES_YET) {
    return (
      <Container className="py-24 text-center">
        <h1 className="text-3xl font-serif text-primary">
          Celebration Stories Coming Soon
        </h1>
        <p className="mt-3 text-text-muted">
          Real couple wedding stories and celebrations will appear here soon.
        </p>
        <div className="mt-8">
          <Button asChild variant="outline">
            <Link href={`/${locale}/real-weddings`}>Back to Real Weddings</Link>
          </Button>
        </div>
      </Container>
    );
  }

  const wedding = await getPublicRealWedding(slug);

  if (!wedding) notFound();

  const isHindi = locale === "hi";
  const couple = t(wedding.coupleName, locale);
  const story = t(wedding.story, locale);
  const summary = t(wedding.summary, locale);
  const hall = t(wedding.hallUsed, locale);

  return (
    <article className="py-16 md:py-24">
      <Container className="max-w-3xl">
        <div className="mb-8">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-6 -ml-2 text-text-muted hover:text-foreground"
          >
            <Link href={`/${locale}/real-weddings`}>
              <ArrowLeft className="size-4 mr-2" />
              {isHindi
                ? "सभी विवाह गाथाओं पर वापस जाएं"
                : "Back to all wedding stories"}
            </Link>
          </Button>

          <p className="text-xs font-semibold tracking-wider uppercase text-primary flex items-center gap-1.5 mb-2">
            <Heart className="size-3.5 fill-primary/30" />
            {wedding.eventDate
              ? formatDateKey(dateKey(wedding.eventDate), "MMMM yyyy")
              : "Celebration"}
          </p>

          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground sm:text-4xl">
            {couple}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted mt-3">
            {hall ? (
              <span className="flex items-center gap-1">
                <MapPin className="size-3 text-primary" />
                {hall}
              </span>
            ) : null}
            {wedding.photographerCredit ? (
              <span className="flex items-center gap-1">
                <Camera className="size-3 text-primary" />
                Photography: {wedding.photographerCredit}
              </span>
            ) : null}
          </div>

          {summary ? (
            <p className="mt-4 text-lg text-text-muted leading-relaxed font-serif italic border-l-2 border-primary/40 pl-4">
              {summary}
            </p>
          ) : null}
        </div>

        {story ? (
          <div className="prose prose-stone max-w-none pt-4 border-t border-border">
            <RichText source={story} />
          </div>
        ) : null}

        <div className="mt-12 rounded-xl border border-border bg-blush/30 p-8 text-center space-y-4">
          <h3 className="text-xl font-serif font-semibold text-foreground">
            {isHindi
              ? "अपने विवाह को भी बनाएं ऐतिहासिक"
              : "Create Your Own Royal Celebration"}
          </h3>
          <p className="text-sm text-text-muted max-w-lg mx-auto">
            {isHindi
              ? "द सुंदरम पैलेस के भव्य हॉल्स और शाही आतिथ्य के साथ अपने विवाह को अविस्मरणीय बनाएं।"
              : "Let our experienced banquet team design an unforgettable wedding experience for you and your family."}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild>
              <Link href={`/${locale}/plan-your-event`}>
                {isHindi ? "कार्यक्रम की योजना बनाएं" : "Plan Your Event"}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${locale}/check-date`}>
                {isHindi
                  ? "तारीख की उपलब्धता जांचें"
                  : "Check Date Availability"}
              </Link>
            </Button>
          </div>
        </div>
      </Container>
    </article>
  );
}
