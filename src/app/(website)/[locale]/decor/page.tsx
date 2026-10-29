import { currentLocale } from "@/i18n/current";

import { ContentPlaceholder } from "@/components/website/content-placeholder";
import { CtaBand } from "@/components/website/cta-band";
import { PageHero } from "@/components/website/page-hero";
import { Section } from "@/components/website/section";
import { ShowcaseBlock } from "@/components/website/showcase-block";
import { RichText } from "@/lib/content/rich-text";
import { t } from "@/lib/i18n/localized";
import { metadataForPage } from "@/server/cms/page-metadata";
import { getPage, listDecorThemes } from "@/server/cms/queries";

export const generateMetadata = () => metadataForPage("STANDARD", "decor", "/decor");

export default async function DecorPage() {
  const locale = await currentLocale();
  const [page, themes] = await Promise.all([getPage("STANDARD", "decor"), listDecorThemes()]);
  const body = t(page?.body, locale);
  return (
    <>
      <PageHero title={t(page?.title, locale) || "Décor"} summary={t(page?.summary, locale)} hero={page?.hero} locale={locale} />
      <Section>
        {body ? (
          <div className="mx-auto mb-14 max-w-3xl">
            <RichText source={body} />
          </div>
        ) : null}
        {themes.length ? (
          <div className="space-y-20 md:space-y-28">
            {themes.map((theme, index) => (
              <ShowcaseBlock
                key={theme.slug}
                id={theme.slug}
                title={t(theme.name, locale)}
                description={t(theme.description, locale)}
                images={theme.images}
                locale={locale}
                index={index}
              />
            ))}
          </div>
        ) : !body ? (
          <ContentPlaceholder />
        ) : null}
      </Section>
      <CtaBand locale={locale} />
    </>
  );
}
