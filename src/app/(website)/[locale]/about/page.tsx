import { Briefcase, Cake, Car, Flower2, Gem, Heart, Landmark, MapPin, Quote, Sparkles, Trees, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { CmsImage } from "@/components/website/cms-image";
import { JsonLd } from "@/components/website/json-ld";
import { PageHero } from "@/components/website/page-hero";
import { Section, SectionHeading } from "@/components/website/section";
import { currentLocale } from "@/i18n/current";
import { Link } from "@/i18n/navigation";
import { env } from "@/lib/env";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { localePath, pageMetadata } from "@/lib/seo/metadata";
import { getAboutPhotos } from "@/server/cms/queries";

/**
 * About page — static, hand-written text (owner request, 28 Oct 2026) in
 * messages/{en,hi}.json under "aboutPage". Only the header photo and the
 * owner's portrait come from the CMS (Website → About); until a portrait is
 * chosen the frame shows his initials.
 */

const PATH = "/about";
/** Directions by place name, so the page needs no settings lookup. */
const DIRECTIONS_URL = "https://www.google.com/maps/dir/?api=1&destination=The%20Sundaram%20Palace%2C%20Lohi%2C%20Rewa%2C%20Madhya%20Pradesh";

const HOST = [
  { key: "weddings", icon: Heart },
  { key: "engagements", icon: Gem },
  { key: "cultural", icon: Flower2 },
  { key: "birthdays", icon: Cake },
  { key: "corporate", icon: Briefcase },
] as const;

const VENUE = [
  { key: "lawn", icon: Trees },
  { key: "hall", icon: Landmark },
  { key: "parking", icon: Car },
  { key: "support", icon: Users },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const [locale, tr, photos] = await Promise.all([currentLocale(), getTranslations("aboutPage"), getAboutPhotos()]);
  return pageMetadata({ locale, path: PATH, title: tr("metaTitle"), description: tr("metaDescription"), imageUrl: photos.header ? cloudinaryImageUrl(photos.header.publicId, 1200) : undefined });
}

export default async function AboutPage() {
  const [locale, tr, cta, nav, photos] = await Promise.all([
    currentLocale(),
    getTranslations("aboutPage"),
    getTranslations("cta"),
    getTranslations("nav"),
    getAboutPhotos(),
  ]);
  const site = env().NEXT_PUBLIC_SITE_URL;
  const url = `${site}${localePath(locale, PATH)}`;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "AboutPage",
              "@id": `${url}#page`,
              url,
              name: tr("metaTitle"),
              description: tr("metaDescription"),
              inLanguage: locale === "hi" ? "hi-IN" : "en-IN",
              mainEntity: { "@id": `${site}/#venue` },
            },
            {
              "@type": "EventVenue",
              "@id": `${site}/#venue`,
              name: "The Sundaram Palace",
              url: site,
              address: {
                "@type": "PostalAddress",
                streetAddress: "Rathara–Silpara Ring Road, near Gudh Road Flyover, Lohi",
                addressLocality: "Rewa",
                addressRegion: "Madhya Pradesh",
                addressCountry: "IN",
              },
              amenityFeature: VENUE.map((v) => ({ "@type": "LocationFeatureSpecification", name: tr(`venue.${v.key}`), value: true })),
            },
            {
              "@type": "Person",
              "@id": `${site}/#owner`,
              name: "Vivek Garg",
              jobTitle: "Owner",
              ...(photos.owner ? { image: cloudinaryImageUrl(photos.owner.publicId, 800) } : {}),
              worksFor: { "@id": `${site}/#venue` },
            },
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: tr("breadcrumbHome"), item: `${site}${localePath(locale, "/")}` },
                { "@type": "ListItem", position: 2, name: tr("title"), item: url },
              ],
            },
          ],
        }}
      />

      <PageHero title={tr("title")} summary={tr("summary")} eyebrow={tr("eyebrow")} hero={photos.header} locale={locale} />

      <Section tone="white" labelledBy="about-intro">
        <div className="mx-auto max-w-3xl text-center">
          <Sparkles className="mx-auto size-6 text-gold" aria-hidden="true" />
          <h2 id="about-intro" className="text-display-2 mt-4">{tr("introHeading")}</h2>
          <span className="gold-rule mx-auto mt-5" aria-hidden="true" />
          <p className="text-body-lg mt-8">{tr("intro1")}</p>
          <p className="text-body-lg mt-4 text-text-muted">{tr("intro2")}</p>
        </div>
      </Section>

      <Section tone="blush" labelledBy="about-owner">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-14">
          <figure className="mx-auto w-full max-w-[12rem] md:max-w-xs">
            {/* Gold portrait frame: the owner's photo from the CMS, or his initials until one is chosen. */}
            <div className="relative aspect-[4/5] rounded-lg border border-gold/60 p-2">
              {photos.owner ? (
                <CmsImage
                  media={photos.owner}
                  locale={locale}
                  sizes="(min-width: 768px) 320px, 192px"
                  className="size-full rounded-md shadow-card"
                />
              ) : (
                <div className="flex size-full flex-col items-center justify-center rounded-md bg-primary-deep text-primary-foreground shadow-card">
                  <span className="font-display text-5xl tracking-[0.1em] md:text-6xl" aria-hidden="true">VG</span>
                  <span className="gold-rule mt-4" aria-hidden="true" />
                </div>
              )}
            </div>
            <figcaption className="sr-only">{tr("owner.name")}</figcaption>
          </figure>
          <div>
            <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">{tr("owner.eyebrow")}</p>
            <span className="gold-rule mt-3" aria-hidden="true" />
            <h2 id="about-owner" className="text-display-2 mt-5">{tr("owner.heading")}</h2>
            <blockquote className="relative mt-6">
              <Quote className="absolute -top-2 -left-1 size-8 text-gold/40" aria-hidden="true" />
              <div className="space-y-4 pl-8">
                {(["p1", "p2", "p3"] as const).map((key) => (
                  <p key={key} className="text-body-lg">{tr(`owner.${key}`)}</p>
                ))}
              </div>
              <footer className="mt-6 pl-8">
                <cite className="font-display text-2xl font-semibold text-primary not-italic">— {tr("owner.name")}</cite>
                <span className="block text-sm text-text-muted">{tr("owner.role")}</span>
              </footer>
            </blockquote>
            <div className="mt-8 pl-8">
              <Button asChild>
                <Link href="/site-visit">{tr("owner.visit")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section labelledBy="about-host">
        <SectionHeading id="about-host" title={tr("hostHeading")} />
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {HOST.map(({ key, icon: Icon }) => (
            <li key={key} className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-5 text-center shadow-card last:col-span-2 md:last:col-span-1">
              <span className="flex size-12 items-center justify-center rounded-full bg-blush text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="font-display text-lg leading-snug font-semibold">{tr(`host.${key}`)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="white" labelledBy="about-venue">
        <SectionHeading id="about-venue" title={tr("venueHeading")} />
        <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {VENUE.map(({ key, icon: Icon }) => (
            <li key={key} className="flex items-start gap-4 rounded-lg bg-surface p-5 shadow-card">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/60 text-gold">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="pt-2">{tr(`venue.${key}`)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="about-find">
        <SectionHeading id="about-find" title={tr("findHeading")} />
        <address className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center not-italic">
          <p className="text-body-lg flex items-start gap-3">
            <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
            <span>{tr("address")}</span>
          </p>
          <Button asChild variant="outline">
            <a href={DIRECTIONS_URL} target="_blank" rel="noopener noreferrer">
              <MapPin aria-hidden="true" />
              {tr("directions")}
            </a>
          </Button>
        </address>
      </Section>

      <Section tone="deep" labelledBy="about-cta">
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="gold-rule" aria-hidden="true" />
          <h2 id="about-cta" className="text-display-2">{tr("ctaHeading")}</h2>
          <p className="text-body-lg max-w-xl text-blush">{tr("ctaText")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="secondary">
              <Link href="/plan-your-event">{cta("planEvent")}</Link>
            </Button>
            <Button asChild variant="outline" className="border-primary-foreground/60 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link href="/contact">{nav("contact")}</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
