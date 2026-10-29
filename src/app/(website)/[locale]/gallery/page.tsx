import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { ContentPlaceholder } from "@/components/website/content-placeholder";
import { CtaBand } from "@/components/website/cta-band";
import { GalleryFilter } from "@/components/website/gallery-filter";
import { LightboxGroup } from "@/components/website/lightbox";
import { PageHero } from "@/components/website/page-hero";
import { PhotoTile } from "@/components/website/photo-tile";
import { Section } from "@/components/website/section";
import { t } from "@/lib/i18n/localized";
import { metadataForPage } from "@/server/cms/page-metadata";
import { getGallery, getPage } from "@/server/cms/queries";

export const generateMetadata = () =>
  metadataForPage("STANDARD", "gallery", "/gallery");

export default async function GalleryPage() {
  const locale = await currentLocale();
  const [page, gallery, tr, lb] = await Promise.all([
    getPage("STANDARD", "gallery"),
    getGallery(),
    getTranslations("gallery"),
    getTranslations("lightbox"),
  ]);
  const usedCategories = gallery.categories.filter((c) =>
    gallery.items.some((i) => i.categoryKey === c.key),
  );
  const categoryName = new Map(
    usedCategories.map((c) => [c.key, t(c.name, locale)]),
  );
  return (
    <>
      <PageHero
        title={t(page?.title, locale) || "Gallery"}
        summary={t(page?.summary, locale)}
        hero={page?.hero}
        locale={locale}
      />
      <Section>
        {gallery.items.length ? (
          <LightboxGroup
            labels={{
              close: lb("close"),
              previous: lb("previous"),
              next: lb("next"),
            }}
          >
            <GalleryFilter
              allLabel={tr("all")}
              filterLabel={tr("filter")}
              categories={usedCategories.map((c) => ({
                key: c.key,
                label: t(c.name, locale),
              }))}
            >
              {gallery.items.map((item) => (
                <figure
                  key={`${item.categoryKey}-${item.asset.publicId}`}
                  data-category={item.categoryKey}
                  className="break-inside-avoid"
                >
                  <PhotoTile
                    media={item.asset}
                    locale={locale}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    label={categoryName.get(item.categoryKey)}
                    className="aspect-[4/3]"
                  />
                  {item.asset.photographerCredit ? (
                    <figcaption className="mt-2 text-xs text-text-muted">
                      {tr("credit", { name: item.asset.photographerCredit })}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </GalleryFilter>
          </LightboxGroup>
        ) : (
          <ContentPlaceholder />
        )}
      </Section>
      <CtaBand locale={locale} />
    </>
  );
}
