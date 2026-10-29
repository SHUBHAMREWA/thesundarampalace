import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { ContentPlaceholder } from "@/components/website/content-placeholder";
import { CtaBand } from "@/components/website/cta-band";
import { PageHero } from "@/components/website/page-hero";
import { Section } from "@/components/website/section";
import { ShowcaseBlock } from "@/components/website/showcase-block";
import { RichText } from "@/lib/content/rich-text";
import { t } from "@/lib/i18n/localized";
import { metadataForPage } from "@/server/cms/page-metadata";
import { getPage, listHalls } from "@/server/cms/queries";

export const generateMetadata = () => metadataForPage("STANDARD", "venues", "/venues");

/** Every published venue, one below the other: title, description, then its photos. */
export default async function VenuesPage() {
  const locale = await currentLocale();
  const [page, halls, tr] = await Promise.all([getPage("STANDARD", "venues"), listHalls(), getTranslations("venues")]);
  const body = t(page?.body, locale);
  return (
    <>
      <PageHero
        title={t(page?.title, locale) || "Venues"}
        summary={t(page?.summary, locale)}
        eyebrow={tr("eyebrow")}
        hero={page?.hero}
        locale={locale}
      />
      <Section>
        {body ? (
          <div className="mx-auto mb-14 max-w-3xl">
            <RichText source={body} />
          </div>
        ) : null}
        {halls.length ? (
          <div className="space-y-20 md:space-y-28">
            {halls.map((hall, index) => (
              <ShowcaseBlock
                key={hall.slug}
                id={hall.slug}
                title={t(hall.name, locale)}
                description={t(hall.description, locale)}
                images={hall.images}
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
