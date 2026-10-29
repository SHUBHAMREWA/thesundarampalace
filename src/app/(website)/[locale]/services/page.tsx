import { currentLocale } from "@/i18n/current";

import { ContentPlaceholder } from "@/components/website/content-placeholder";
import { CtaBand } from "@/components/website/cta-band";
import { PageHero } from "@/components/website/page-hero";
import { Section } from "@/components/website/section";
import { ShowcaseBlock } from "@/components/website/showcase-block";
import { RichText } from "@/lib/content/rich-text";
import { t } from "@/lib/i18n/localized";
import { metadataForPage } from "@/server/cms/page-metadata";
import { getPage, listCelebrations } from "@/server/cms/queries";

export const generateMetadata = () => metadataForPage("STANDARD", "services", "/services");

/** Every celebration, one below the other: title, description, then its photos. */
export default async function ServicesPage() {
  const locale = await currentLocale();
  const [page, celebrations] = await Promise.all([getPage("STANDARD", "services"), listCelebrations()]);
  const body = t(page?.body, locale);
  return (
    <>
      <PageHero title={t(page?.title, locale) || "Celebrations"} summary={t(page?.summary, locale)} hero={page?.hero} locale={locale} />
      <Section>
        {body ? (
          <div className="mx-auto mb-14 max-w-3xl">
            <RichText source={body} />
          </div>
        ) : null}
        {celebrations.length ? (
          <div className="space-y-20 md:space-y-28">
            {celebrations.map((item, index) => (
              <ShowcaseBlock
                key={item.slug}
                id={item.slug}
                title={t(item.title, locale)}
                description={t(item.description, locale)}
                images={item.images}
                locale={locale}
                index={index}
              />
            ))}
          </div>
        ) : (
          <ContentPlaceholder />
        )}
      </Section>
      <CtaBand locale={locale} />
    </>
  );
}
