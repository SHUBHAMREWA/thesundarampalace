import { Check, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { Button } from "@/components/ui/button";
import { CmsImage } from "@/components/website/cms-image";
import { CtaBand } from "@/components/website/cta-band";
import { PageHero } from "@/components/website/page-hero";
import { Section } from "@/components/website/section";
import { Link } from "@/i18n/navigation";
import { RichText } from "@/lib/content/rich-text";
import { HALL_LAYOUTS } from "@/lib/content/catalog";
import { t } from "@/lib/i18n/localized";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { pageMetadata } from "@/lib/seo/metadata";
import { getHall, listEventTypes, listHalls } from "@/server/cms/queries";

/** With Cache Components a dynamic segment needs at least one param at build. */
const NO_HALLS_YET = "coming-soon";

export async function generateStaticParams() {
  const halls = await listHalls();
  return halls.length ? halls.map((h) => ({ slug: h.slug })) : [{ slug: NO_HALLS_YET }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/venues/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await currentLocale();
  const hall = await getHall(slug);
  if (!hall) return {};
  return pageMetadata({
    locale,
    path: `/venues/${slug}`,
    title: t(hall.seo?.title, locale) || t(hall.name, locale),
    description: t(hall.seo?.description, locale) || t(hall.summary, locale),
    imageUrl: hall.hero ? cloudinaryImageUrl(hall.hero.publicId, 1200) : undefined,
  });
}

export default async function HallPage({ params }: PageProps<"/[locale]/venues/[slug]">) {
  const { slug } = await params;
  const locale = await currentLocale();
  const [hall, eventTypes, tr, ph, cta, catalog] = await Promise.all([
    getHall(slug),
    listEventTypes(),
    getTranslations("venues"),
    getTranslations("placeholder"),
    getTranslations("cta"),
    getTranslations("catalog"),
  ]);
  if (!hall) notFound();

  const capacities = HALL_LAYOUTS.map((layout) => ({
    layout,
    value: hall.capacities.find((c) => c.layout === layout),
  })).filter((c) => c.value && (c.value.minGuests || c.value.maxGuests));
  const suitable = eventTypes.filter((e) => hall.eventTypeKeys.includes(e.key));
  const description = t(hall.description, locale);

  return (
    <>
      <PageHero title={t(hall.name, locale)} summary={t(hall.summary, locale)} eyebrow={tr("eyebrow")} hero={hall.hero} locale={locale} />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[2fr_1fr]">
          <div>
            {description ? <RichText source={description} /> : <p className="text-body-lg text-text-muted">{ph("content")}</p>}
            {hall.images.length ? (
              <div className="mt-10">
                <h2 className="text-display-3">{tr("photos")}</h2>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {hall.images.map((image) => (
                    <CmsImage key={image.publicId} media={image} locale={locale} sizes="(min-width: 1024px) 33vw, 50vw" className="aspect-[4/3] rounded-md" />
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-10">
              <h2 className="text-display-3">{tr("floorPlan")}</h2>
              <CmsImage media={hall.floorPlan} locale={locale} sizes="(min-width: 1024px) 66vw, 100vw" className="mt-4 aspect-[16/10] rounded-md" />
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-lg bg-surface p-6 shadow-card">
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-text-muted">{tr("area")}</dt>
                  <dd className="text-base font-medium">
                    {hall.areaSqFt ? tr("sqft", { value: hall.areaSqFt.toLocaleString("en-IN") }) : ph("facts")}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">{tr("ceiling")}</dt>
                  <dd className="text-base font-medium">
                    {hall.ceilingHeightFt ? tr("feet", { value: Number(hall.ceilingHeightFt).toString() }) : ph("facts")}
                  </dd>
                </div>
                <div>
                  <dt className="text-text-muted">{tr("capacity")}</dt>
                  <dd>
                    {capacities.length ? (
                      <ul className="mt-1 space-y-1">
                        {capacities.map(({ layout, value }) => (
                          <li key={layout} className="flex justify-between gap-3">
                            <span>{catalog(`layout.${layout}`)}</span>
                            <span className="font-medium">
                              {value!.minGuests && value!.maxGuests
                                ? tr("capacityRange", { min: value!.minGuests, max: value!.maxGuests })
                                : tr("capacityUpTo", { max: value!.maxGuests ?? value!.minGuests ?? 0 })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-base font-medium">{ph("facts")}</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg bg-surface p-6 shadow-card">
              <h2 className="font-medium">{tr("facilities")}</h2>
              {hall.facilities.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {hall.facilities.map((f) => (
                    <li key={f.key} className="flex gap-2">
                      <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
                      <span>
                        {catalog.has(`facility.${f.key}`) ? catalog(`facility.${f.key}`) : f.key}
                        {f.note ? <span className="text-text-muted"> — {f.note}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-text-muted">{ph("facts")}</p>
              )}
            </div>

            {suitable.length ? (
              <div className="rounded-lg bg-surface p-6 shadow-card">
                <h2 className="font-medium">{tr("suitableFor")}</h2>
                <p className="mt-2 text-sm">{suitable.map((e) => t(e.label, locale)).join(" · ")}</p>
              </div>
            ) : null}

            {hall.slotsInfo ? (
              <div className="rounded-lg bg-surface p-6 shadow-card">
                <h2 className="font-medium">{tr("slots")}</h2>
                <div className="mt-2 text-sm">
                  <RichText source={t(hall.slotsInfo, locale)} className="space-y-2" />
                </div>
              </div>
            ) : null}

            {hall.tourUrl ? (
              <Button asChild variant="outline" className="w-full">
                <a href={hall.tourUrl} target="_blank" rel="noopener noreferrer">
                  {tr("watchTour")}
                  <ExternalLink aria-hidden="true" />
                </a>
              </Button>
            ) : null}

            <Button asChild className="w-full">
              <Link href={`/plan-your-event?hall=${hall.slug}`}>{cta("enquireAboutVenue")}</Link>
            </Button>
          </aside>
        </div>
      </Section>
      <CtaBand locale={locale} />
    </>
  );
}
