import { ChevronDown, ExternalLink, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { CmsImage } from "@/components/website/cms-image";
import { ContactActions } from "@/components/website/contact-actions";
import { ContentPlaceholder } from "@/components/website/content-placeholder";
import { EnquiryForm } from "@/components/website/enquiry-form";
import { HallCard } from "@/components/website/hall-card";
import { HeroSlideshow } from "@/components/website/hero-slideshow";
import { HeroVideo } from "@/components/website/hero-video";
import { JsonLd } from "@/components/website/json-ld";
import { LightboxGroup } from "@/components/website/lightbox";
import { PhotoTile } from "@/components/website/photo-tile";
import { TestimonialCard } from "@/components/website/testimonial-card";
import { PictureCarousel } from "@/components/website/picture-carousel";
import { Section, SectionHeading } from "@/components/website/section";
import { Link } from "@/i18n/navigation";
import { t } from "@/lib/i18n/localized";
import { directionsUrl, mapEmbedUrl } from "@/lib/contact/map";
import {
  cloudinaryImageUrl,
  cloudinaryVideoPoster,
  cloudinaryVideoUrl,
} from "@/lib/media/cloudinary";
import { DEFAULT_OG_IMAGE, pageMetadata } from "@/lib/seo/metadata";
import { eventVenueJsonLd, websiteJsonLd } from "@/lib/seo/structured-data";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { enquiryFormProps } from "@/server/cms/enquiry-props";
import {
  getGallery,
  getHomeSections,
  getPage,
  getPublicContact,
  listDecorThemes,
  listHalls,
  listPages,
  listTestimonials,
  type HomeSectionView,
  type MediaView,
} from "@/server/cms/queries";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await currentLocale();
  const [page, tr] = await Promise.all([
    getPage("STANDARD", "home"),
    getTranslations("home"),
  ]);
  const meta = pageMetadata({
    locale,
    path: "/",
    title: t(page?.seo?.title, locale) || tr("metaTitle"),
    description: t(page?.seo?.description, locale) || tr("metaDescription"),
  });
  return { ...meta, title: { absolute: String(meta.title) } };
}

/** Left/right carousel of the pictures chosen for a section in the CMS. */
async function SectionPictures({
  pictures,
  locale,
}: {
  pictures: MediaView[];
  locale: string;
}) {
  if (!pictures.length) return null;
  const [home, lb] = await Promise.all([
    getTranslations("home"),
    getTranslations("lightbox"),
  ]);
  return (
    <LightboxGroup
      className="mb-10"
      labels={{
        close: lb("close"),
        previous: lb("previous"),
        next: lb("next"),
      }}
    >
      <PictureCarousel
        labels={{ previous: home("previous"), next: home("next") }}
      >
        {pictures.map((picture) => (
          <PhotoTile
            key={picture.publicId}
            media={picture}
            locale={locale}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 85vw"
            className="aspect-[4/3]"
          />
        ))}
      </PictureCarousel>
    </LightboxGroup>
  );
}

async function HomeSectionBlock({
  section,
  locale,
}: {
  section: HomeSectionView;
  locale: string;
}) {
  const heading = t(section.heading, locale);
  const intro = t(section.intro, locale);
  const cta = await getTranslations("cta");

  switch (section.type) {
    case "hero": {
      const [contact, home] = await Promise.all([
        getPublicContact(),
        getTranslations("home"),
      ]);
      return (
        <>
          <section className="relative isolate flex min-h-[85svh] items-center overflow-hidden bg-primary-deep text-primary-foreground">
            {section.heroMedia === "video" ? (
              <>
                {section.poster ? (
                  <CmsImage
                    media={section.poster}
                    locale={locale}
                    sizes="100vw"
                    priority
                    className="absolute inset-0 -z-30"
                  />
                ) : section.video ? (
                  // No poster chosen: a still frame of the film shows while it loads.
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary video frame, not an image asset
                  <img
                    src={cloudinaryVideoPoster(section.video.publicId, 1600)}
                    alt=""
                    className="absolute inset-0 -z-30 size-full object-cover"
                    fetchPriority="high"
                  />
                ) : null}
                {section.video ? (
                  <HeroVideo
                    src={cloudinaryVideoUrl(section.video.publicId, 1920)}
                    mobileSrc={cloudinaryVideoUrl(section.video.publicId, 720)}
                    poster={
                      section.poster
                        ? undefined
                        : cloudinaryVideoPoster(section.video.publicId, 1280)
                    }
                  />
                ) : section.videoPath ? (
                  <HeroVideo src={section.videoPath} />
                ) : null}
              </>
            ) : section.slides?.length ? (
              <HeroSlideshow
                labels={{
                  previous: home("previous"),
                  next: home("next"),
                  slide: home("slide"),
                }}
              >
                {section.slides.map((slide, i) => (
                  <CmsImage
                    key={slide.publicId}
                    media={slide}
                    locale={locale}
                    sizes="100vw"
                    priority={i === 0}
                    className="absolute inset-0"
                  />
                ))}
              </HeroSlideshow>
            ) : section.poster ? (
              <CmsImage
                media={section.poster}
                locale={locale}
                sizes="100vw"
                priority
                className="absolute inset-0 -z-30"
              />
            ) : null}
            <div
              className="absolute inset-0 -z-10 bg-primary-deep/60"
              aria-hidden="true"
            />
            <Container className="flex flex-col items-center py-24 text-center">
              <p className="text-xs font-medium tracking-[0.25em] text-blush uppercase">
                {home("eyebrow")}
              </p>
              <span className="gold-rule mt-4" aria-hidden="true" />
              <h1 className="text-display-1 mt-6 max-w-4xl">
                {heading || "The Sundaram Palace"}
              </h1>
              {t(section.subheading, locale) ? (
                <p className="text-body-lg mt-6 max-w-2xl text-blush">
                  {t(section.subheading, locale)}
                </p>
              ) : null}
              <div className="mt-10">
                <ContactActions contact={contact} locale={locale} inverted />
              </div>
            </Container>
            {/* Scroll-down arrow, bottom centre (above the slideshow dots when there are slides). */}
            <a
              href="#after-hero"
              aria-label={home("scrollDown")}
              className={cn(
                "absolute left-1/2 z-20 flex size-11 -translate-x-1/2 items-center justify-center rounded-full border border-primary-foreground/50 text-primary-foreground transition-colors hover:bg-primary-foreground/15",
                section.heroMedia !== "video" &&
                  (section.slides?.length ?? 0) > 1
                  ? "bottom-14"
                  : "bottom-6",
              )}
            >
              <ChevronDown
                className="size-5 animate-bounce"
                aria-hidden="true"
              />
            </a>
          </section>
          <span
            id="after-hero"
            className="block scroll-mt-16"
            aria-hidden="true"
          />
        </>
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
      const [halls, venues] = await Promise.all([
        listHalls(),
        getTranslations("venues"),
      ]);
      return (
        <Section tone="white" labelledBy="home-venues">
          <SectionHeading
            id="home-venues"
            eyebrow={venues("eyebrow")}
            title={heading}
            intro={intro}
          />
          <SectionPictures pictures={section.pictures} locale={locale} />
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
      if (!services.length && !section.pictures.length) return null;
      return (
        <Section labelledBy="home-services">
          <SectionHeading id="home-services" title={heading} intro={intro} />
          <SectionPictures pictures={section.pictures} locale={locale} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <li key={service.slug}>
                <Link
                  href={`/services#${service.slug}`}
                  className="flex h-full flex-col rounded-lg border border-border bg-surface p-6 transition-colors hover:border-primary"
                >
                  <span className="text-display-3">
                    {t(service.title, locale)}
                  </span>
                  {service.summary ? (
                    <span className="mt-2 text-text-muted">
                      {t(service.summary, locale)}
                    </span>
                  ) : null}
                  <span className="mt-4 text-sm font-medium text-primary">
                    {cta("learnMore")} →
                  </span>
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
          <SectionPictures pictures={section.pictures} locale={locale} />
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
              <figure
                key={theme.slug}
                className="overflow-hidden rounded-lg bg-surface shadow-card"
              >
                <CmsImage
                  media={theme.images[0] ?? null}
                  locale={locale}
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="aspect-[4/3]"
                />
                <figcaption className="p-5 font-display text-xl">
                  {t(theme.name, locale)}
                </figcaption>
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
    case "gallery": {
      const [gallery, lb] = await Promise.all([
        getGallery(),
        getTranslations("lightbox"),
      ]);
      if (!gallery.items.length) return null;
      return (
        <Section labelledBy="home-gallery">
          <SectionHeading id="home-gallery" title={heading} intro={intro} />
          <LightboxGroup
            labels={{
              close: lb("close"),
              previous: lb("previous"),
              next: lb("next"),
            }}
            className="grid grid-cols-2 gap-3 md:grid-cols-4"
          >
            {gallery.items.slice(0, 8).map((item) => (
              <PhotoTile
                key={item.asset.publicId}
                media={item.asset}
                locale={locale}
                sizes="(min-width: 768px) 25vw, 50vw"
                className="aspect-square"
              />
            ))}
          </LightboxGroup>
          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link href="/gallery">{cta("viewGallery")}</Link>
            </Button>
          </div>
        </Section>
      );
    }
    case "reviews": {
      // Guest testimonials (added in the CMS with the guest's permission), then the Google reviews link.
      const [contact, home, testimonials] = await Promise.all([
        getPublicContact(),
        getTranslations("home"),
        listTestimonials(),
      ]);
      const google = contact.contact.googleReviewsUrl;
      if (!testimonials.length && !google) return null;
      return (
        <Section tone="blush" labelledBy="home-reviews">
          <SectionHeading
            id="home-reviews"
            title={heading}
            intro={intro || (testimonials.length ? "" : home("reviewsIntro"))}
          />
          {testimonials.length ? (
            <PictureCarousel
              labels={{ previous: home("previous"), next: home("next") }}
            >
              {testimonials.map((testimonial) => (
                <TestimonialCard
                  key={testimonial.id}
                  testimonial={testimonial}
                  locale={locale}
                />
              ))}
            </PictureCarousel>
          ) : null}
          {google ? (
            <div
              className={
                testimonials.length ? "mt-10 text-center" : "text-center"
              }
            >
              <Button
                asChild
                variant={testimonials.length ? "outline" : "default"}
              >
                <a href={google} target="_blank" rel="noopener noreferrer">
                  {cta("googleReviews")}
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
            </div>
          ) : null}
        </Section>
      );
    }
    case "contact": {
      const [props, ph, home] = await Promise.all([
        enquiryFormProps(locale),
        getTranslations("placeholder"),
        getTranslations("home"),
      ]);
      const { contact, ...formProps } = props;
      const map = mapEmbedUrl(contact);
      const directions = directionsUrl(contact);
      return (
        <Section tone="white" labelledBy="home-contact">
          <SectionHeading id="home-contact" title={heading} intro={intro} />
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="space-y-6">
              {contact.address ? (
                <p className="text-body-lg flex gap-3">
                  <MapPin
                    className="mt-1 size-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{contact.address}</span>
                </p>
              ) : (
                <p className="text-text-muted">{ph("contact")}</p>
              )}
              {map ? (
                <div className="overflow-hidden rounded-lg shadow-card">
                  <iframe
                    src={map}
                    title={home("mapTitle")}
                    className="aspect-[4/3] w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-4">
                {directions ? (
                  <Button asChild>
                    <a
                      href={directions}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin aria-hidden="true" />
                      {cta("directions")}
                    </a>
                  </Button>
                ) : null}
                <ContactActions
                  contact={contact}
                  locale={locale}
                  showPlan={false}
                />
              </div>
            </div>
            <div>
              <h3 className="text-display-3 mb-6">{home("enquiryTitle")}</h3>
              <EnquiryForm {...formProps} />
            </div>
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
  const [sections, contact, halls] = await Promise.all([
    getHomeSections(),
    getPublicContact(),
    listHalls(),
  ]);
  const hero = sections.find((s) => s.type === "hero");
  const posterUrl = hero?.poster
    ? cloudinaryImageUrl(hero.poster.publicId, 1200)
    : halls[0]?.images[0]
      ? cloudinaryImageUrl(halls[0].images[0].publicId, 1200)
      : null;
  const site = env().NEXT_PUBLIC_SITE_URL;
  return (
    <>
      <JsonLd data={websiteJsonLd({ name: contact.displayName, url: site, inLanguage: locale === "hi" ? "hi-IN" : "en-IN" })} />
      <JsonLd
        data={eventVenueJsonLd({
          name: contact.displayName,
          url: `${site}/${locale}`,
          telephone: contact.phone,
          email: contact.email,
          streetAddress: contact.address,
          city: contact.city,
          imageUrl: posterUrl ?? `${site}${DEFAULT_OG_IMAGE.url}`,
          sameAs: [
            contact.contact.instagramUrl,
            contact.contact.facebookUrl,
            contact.contact.youtubeUrl,
          ],
        })}
      />
      {sections
        .filter((section) => section.visible)
        .map((section) => (
          <HomeSectionBlock
            key={section.type}
            section={section}
            locale={locale}
          />
        ))}
    </>
  );
}
