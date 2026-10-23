import { CalendarHeart, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { CmsImage } from "@/components/website/cms-image";
import { ContactActions } from "@/components/website/contact-actions";
import { ContentPlaceholder } from "@/components/website/content-placeholder";
import { HallCard } from "@/components/website/hall-card";
import { HeroVideo } from "@/components/website/hero-video";
import { JsonLd } from "@/components/website/json-ld";
import { Section, SectionHeading } from "@/components/website/section";
import { Link } from "@/i18n/navigation";
import { t } from "@/lib/i18n/localized";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { pageMetadata } from "@/lib/seo/metadata";
import { eventVenueJsonLd } from "@/lib/seo/structured-data";
import { env } from "@/lib/env";
import {
  getGallery,
  getHomeSections,
  getPage,
  getPublicContact,
  listAuspiciousDates,
  listDecorThemes,
  listHalls,
  listPackages,
  listPages,
  type HomeSectionView,
} from "@/server/cms/queries";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const [page, tr] = await Promise.all([getPage("STANDARD", "home"), getTranslations("home")]);
  const meta = pageMetadata({
    locale,
    path: "/",
    title: t(page?.seo?.title, locale) || tr("metaTitle"),
    description: t(page?.seo?.description, locale) || tr("metaDescription"),
  });
  return { ...meta, title: { absolute: String(meta.title) } };
}

const formatDate = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));

async function HomeSectionBlock({ section, locale }: { section: HomeSectionView; locale: string }) {
  const heading = t(section.heading, locale);
  const intro = t(section.intro, locale);
  const cta = await getTranslations("cta");

  switch (section.type) {
    case "hero": {
      const [contact, home] = await Promise.all([getPublicContact(), getTranslations("home")]);
      return (
        <section className="relative isolate flex min-h-[85svh] items-center overflow-hidden bg-primary-deep text-primary-foreground">
          {section.poster ? (
            <CmsImage media={section.poster} locale={locale} sizes="100vw" priority className="absolute inset-0 -z-30" />
          ) : null}
          {section.videoPath ? <HeroVideo src={section.videoPath} /> : null}
          <div className="absolute inset-0 -z-10 bg-primary-deep/60" aria-hidden="true" />
          <Container className="flex flex-col items-center py-24 text-center">
            <p className="text-xs font-medium tracking-[0.25em] text-blush uppercase">{home("eyebrow")}</p>
            <span className="gold-rule mt-4" aria-hidden="true" />
            <h1 className="text-display-1 mt-6 max-w-4xl">{heading || "The Sundaram Palace"}</h1>
            {t(section.subheading, locale) ? (
              <p className="text-body-lg mt-6 max-w-2xl text-blush">{t(section.subheading, locale)}</p>
            ) : null}
            <div className="mt-10">
              <ContactActions contact={contact} locale={locale} inverted />
            </div>
          </Container>
        </section>
      );
    }
    case "intro":
      if (!intro) return null;
      return (
        <Section labelledBy="home-intro">
          <SectionHeading id="home-intro" title={heading} intro={intro} />
        </Section>
      );
    case "venues": {
      const [halls, venues] = await Promise.all([listHalls(), getTranslations("venues")]);
      return (
        <Section tone="white" labelledBy="home-venues">
          <SectionHeading id="home-venues" eyebrow={venues("eyebrow")} title={heading} intro={intro} />
          {halls.length ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {halls.slice(0, 3).map((hall) => (
                  <HallCard key={hall.slug} hall={hall} locale={locale} />
                ))}
              </div>
              <div className="mt-10 text-center">
                <Button asChild variant="outline">
                  <Link href="/venues">{cta("allVenues")}</Link>
                </Button>
              </div>
            </>
          ) : (
            <ContentPlaceholder kind="list" />
          )}
        </Section>
      );
    }
    case "services": {
      const services = await listPages("SERVICE");
      if (!services.length) return null;
      return (
        <Section labelledBy="home-services">
          <SectionHeading id="home-services" title={heading} intro={intro} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <li key={service.slug}>
                <Link
                  href={`/services/${service.slug}`}
                  className="flex h-full flex-col rounded-lg border border-border bg-surface p-6 transition-colors hover:border-primary"
                >
                  <span className="text-display-3">{t(service.title, locale)}</span>
                  {service.summary ? <span className="mt-2 text-text-muted">{t(service.summary, locale)}</span> : null}
                  <span className="mt-4 text-sm font-medium text-primary">{cta("learnMore")} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      );
    }
    case "catering":
      return (
        <Section tone="blush" labelledBy="home-catering">
          <SectionHeading id="home-catering" title={heading} intro={intro} />
          <div className="text-center">
            <Button asChild variant="outline">
              <Link href="/catering">{cta("seeMenus")}</Link>
            </Button>
          </div>
        </Section>
      );
    case "decor": {
      const themes = await listDecorThemes();
      if (!themes.length) return null;
      return (
        <Section labelledBy="home-decor">
          <SectionHeading id="home-decor" title={heading} intro={intro} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {themes.slice(0, 3).map((theme) => (
              <figure key={theme.slug} className="overflow-hidden rounded-lg bg-surface shadow-card">
                <CmsImage media={theme.images[0] ?? null} locale={locale} sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[4/3]" />
                <figcaption className="p-5 font-display text-xl">{t(theme.name, locale)}</figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href="/decor">{cta("seeThemes")}</Link>
            </Button>
          </div>
        </Section>
      );
    }
    case "packages": {
      const packages = await listPackages();
      if (!packages.length) return null;
      return (
        <Section tone="white" labelledBy="home-packages">
          <SectionHeading id="home-packages" title={heading} intro={intro} />
          <ul className="grid gap-6 md:grid-cols-3">
            {packages.slice(0, 3).map((pkg) => (
              <li key={pkg.slug} className="rounded-lg border border-border bg-bg p-6">
                <p className="text-display-3">{t(pkg.name, locale)}</p>
                {pkg.description ? <p className="mt-2 text-text-muted">{t(pkg.description, locale)}</p> : null}
              </li>
            ))}
          </ul>
          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href="/packages">{cta("seePackages")}</Link>
            </Button>
          </div>
        </Section>
      );
    }
    case "gallery": {
      const gallery = await getGallery();
      if (!gallery.items.length) return null;
      return (
        <Section labelledBy="home-gallery">
          <SectionHeading id="home-gallery" title={heading} intro={intro} />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {gallery.items.slice(0, 8).map((item) => (
              <CmsImage
                key={item.asset.publicId}
                media={item.asset}
                locale={locale}
                sizes="(min-width: 768px) 25vw, 50vw"
                className="aspect-square rounded-md"
              />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href="/gallery">{cta("viewGallery")}</Link>
            </Button>
          </div>
        </Section>
      );
    }
    case "reviews": {
      const [contact, home] = await Promise.all([getPublicContact(), getTranslations("home")]);
      if (!contact.contact.googleReviewsUrl) return null;
      return (
        <Section tone="blush" labelledBy="home-reviews">
          <SectionHeading id="home-reviews" title={heading} intro={intro || home("reviewsIntro")} />
          <div className="text-center">
            <Button asChild>
              <a href={contact.contact.googleReviewsUrl} target="_blank" rel="noopener noreferrer">
                {cta("googleReviews")}
                <ExternalLink aria-hidden="true" />
              </a>
            </Button>
          </div>
        </Section>
      );
    }
    case "dates": {
      const [dates, home] = await Promise.all([listAuspiciousDates(), getTranslations("home")]);
      if (!dates.length) return null;
      return (
        <Section labelledBy="home-dates">
          <SectionHeading id="home-dates" title={heading} intro={intro || home("datesIntro")} />
          <ul className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
            {dates.map((d) => (
              <li key={d.date + t(d.label, locale)} className="flex items-start gap-3 rounded-md bg-surface p-4 shadow-card">
                <CalendarHeart className="mt-0.5 size-5 shrink-0 text-gold" aria-hidden="true" />
                <div>
                  <p className="font-medium">{formatDate(d.date, locale)}</p>
                  <p className="text-sm text-text-muted">{t(d.label, locale)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      );
    }
    case "contact": {
      const contact = await getPublicContact();
      const ph = await getTranslations("placeholder");
      return (
        <Section tone="white" labelledBy="home-contact">
          <SectionHeading id="home-contact" title={heading} intro={intro} />
          <div className="flex flex-col items-center gap-6 text-center">
            {contact.address ? <p className="text-body-lg max-w-xl">{contact.address}</p> : <p className="text-text-muted">{ph("contact")}</p>}
            <ContactActions contact={contact} locale={locale} showPlan={false} />
            <Link href="/contact" className="text-sm font-medium text-primary underline underline-offset-4">
              {cta("directions")}
            </Link>
          </div>
        </Section>
      );
    }
    default:
      return null;
  }
}

export default async function HomePage() {
  const locale = await currentLocale();
  const [sections, contact, halls] = await Promise.all([getHomeSections(), getPublicContact(), listHalls()]);
  const hero = sections.find((s) => s.type === "hero");
  const posterUrl = hero?.poster ? cloudinaryImageUrl(hero.poster.publicId, 1200) : halls[0]?.hero ? cloudinaryImageUrl(halls[0].hero.publicId, 1200) : null;
  return (
    <>
      <JsonLd
        data={eventVenueJsonLd({
          name: contact.displayName,
          url: `${env().NEXT_PUBLIC_SITE_URL}/${locale}`,
          telephone: contact.phone,
          email: contact.email,
          streetAddress: contact.address,
          city: contact.city,
          imageUrl: posterUrl,
          sameAs: [contact.contact.instagramUrl, contact.contact.facebookUrl, contact.contact.youtubeUrl],
        })}
      />
      {sections
        .filter((section) => section.visible)
        .map((section) => (
          <HomeSectionBlock key={section.type} section={section} locale={locale} />
        ))}
    </>
  );
}
