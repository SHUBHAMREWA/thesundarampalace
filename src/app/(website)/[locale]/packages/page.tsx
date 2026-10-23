import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { Button } from "@/components/ui/button";
import { ContentPlaceholder } from "@/components/website/content-placeholder";
import { CtaBand } from "@/components/website/cta-band";
import { PageHero } from "@/components/website/page-hero";
import { Section } from "@/components/website/section";
import { Link } from "@/i18n/navigation";
import { linesOf, RichText } from "@/lib/content/rich-text";
import { t } from "@/lib/i18n/localized";
import { formatINR } from "@/lib/money";
import { metadataForPage } from "@/server/cms/page-metadata";
import { getPage, listPackages } from "@/server/cms/queries";

export const generateMetadata = () => metadataForPage("STANDARD", "packages", "/packages");

export default async function PackagesPage() {
  const locale = await currentLocale();
  const [page, packages, tr, cta] = await Promise.all([
    getPage("STANDARD", "packages"),
    listPackages(),
    getTranslations("packages"),
    getTranslations("cta"),
  ]);
  const body = t(page?.body, locale);
  return (
    <>
      <PageHero title={t(page?.title, locale) || "Packages"} summary={t(page?.summary, locale)} hero={page?.hero} locale={locale} />
      <Section>
        {body ? (
          <div className="mx-auto mb-14 max-w-3xl">
            <RichText source={body} />
          </div>
        ) : null}
        {packages.length ? (
          <div className="grid gap-8 lg:grid-cols-3">
            {packages.map((pkg) => {
              const inclusions = linesOf(t(pkg.inclusions, locale));
              const addOns = linesOf(t(pkg.addOns, locale));
              return (
                <article key={pkg.slug} className="flex flex-col rounded-lg bg-surface p-8 shadow-card">
                  <h2 className="text-display-3">{t(pkg.name, locale)}</h2>
                  <p className="mt-2 font-medium text-primary">
                    {pkg.publicPrice ? tr("startingFrom", { price: formatINR(pkg.publicPrice) }) : tr("priceOnRequest")}
                  </p>
                  {pkg.publicPriceNote ? <p className="text-xs text-text-muted">{t(pkg.publicPriceNote, locale)}</p> : null}
                  {pkg.description ? <p className="mt-4 text-text-muted">{t(pkg.description, locale)}</p> : null}
                  {inclusions.length ? (
                    <div className="mt-5">
                      <h3 className="text-sm font-semibold">{tr("includes")}</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        {inclusions.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {addOns.length ? (
                    <div className="mt-5">
                      <h3 className="text-sm font-semibold">{tr("addOns")}</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        {addOns.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {pkg.terms ? <p className="mt-5 text-xs text-text-muted">{t(pkg.terms, locale)}</p> : null}
                  <Button asChild className="mt-auto w-full" variant="outline">
                    <Link href="/plan-your-event">{cta("planEvent")}</Link>
                  </Button>
                </article>
              );
            })}
          </div>
        ) : !body ? (
          <ContentPlaceholder />
        ) : null}
      </Section>
      <CtaBand locale={locale} />
    </>
  );
}
