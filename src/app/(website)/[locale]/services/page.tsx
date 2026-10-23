import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { CmsImage } from "@/components/website/cms-image";
import { CtaBand } from "@/components/website/cta-band";
import { PageHero } from "@/components/website/page-hero";
import { Section } from "@/components/website/section";
import { Link } from "@/i18n/navigation";
import { RichText } from "@/lib/content/rich-text";
import { t } from "@/lib/i18n/localized";
import { metadataForPage } from "@/server/cms/page-metadata";
import { getPage, listPages } from "@/server/cms/queries";

export const generateMetadata = () => metadataForPage("STANDARD", "services", "/services");

export default async function ServicesPage() {
  const locale = await currentLocale();
  const [page, services, cta] = await Promise.all([
    getPage("STANDARD", "services"),
    listPages("SERVICE"),
    getTranslations("cta"),
  ]);
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
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <li key={service.slug}>
              <Link href={`/services/${service.slug}`} className="group flex h-full flex-col overflow-hidden rounded-lg bg-surface shadow-card">
                <CmsImage media={service.hero} locale={locale} sizes="(min-width: 1024px) 33vw, 100vw" className="aspect-[4/3]" />
                <span className="flex flex-1 flex-col p-6">
                  <span className="text-display-3">{t(service.title, locale)}</span>
                  {service.summary ? <span className="mt-2 text-text-muted">{t(service.summary, locale)}</span> : null}
                  <span className="mt-4 text-sm font-medium text-primary group-hover:underline">{cta("learnMore")} →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
      <CtaBand locale={locale} />
    </>
  );
}
