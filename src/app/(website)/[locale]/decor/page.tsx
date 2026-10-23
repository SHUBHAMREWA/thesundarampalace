import { currentLocale } from "@/i18n/current";

import { CmsImage } from "@/components/website/cms-image";
import { ContentPlaceholder } from "@/components/website/content-placeholder";
import { CtaBand } from "@/components/website/cta-band";
import { PageHero } from "@/components/website/page-hero";
import { Section } from "@/components/website/section";
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
          <div className="space-y-16">
            {themes.map((theme) => (
              <article key={theme.slug} id={theme.slug} className="scroll-mt-24">
                <h2 className="text-display-2">{t(theme.name, locale)}</h2>
                {theme.description ? (
                  <div className="mt-3 max-w-3xl text-text-muted">
                    <RichText source={t(theme.description, locale)} className="space-y-3" />
                  </div>
                ) : null}
                <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
                  {(theme.images.length ? theme.images : [null]).map((image, i) => (
                    <CmsImage key={image?.publicId ?? i} media={image} locale={locale} sizes="(min-width: 768px) 33vw, 50vw" className="aspect-[4/3] rounded-md" />
                  ))}
                </div>
              </article>
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
