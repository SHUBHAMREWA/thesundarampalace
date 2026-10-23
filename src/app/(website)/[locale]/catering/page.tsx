import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { ContentPlaceholder } from "@/components/website/content-placeholder";
import { CtaBand } from "@/components/website/cta-band";
import { PageHero } from "@/components/website/page-hero";
import { Section } from "@/components/website/section";
import { MENU_COURSES } from "@/lib/content/catalog";
import { RichText } from "@/lib/content/rich-text";
import { t } from "@/lib/i18n/localized";
import { metadataForPage } from "@/server/cms/page-metadata";
import { getPage, listPublicMenus } from "@/server/cms/queries";

export const generateMetadata = () => metadataForPage("STANDARD", "catering", "/catering");

export default async function CateringPage() {
  const locale = await currentLocale();
  const [page, menus, catalog] = await Promise.all([
    getPage("STANDARD", "catering"),
    listPublicMenus(),
    getTranslations("catalog"),
  ]);
  const body = t(page?.body, locale);
  return (
    <>
      <PageHero title={t(page?.title, locale) || "Catering"} summary={t(page?.summary, locale)} hero={page?.hero} locale={locale} />
      <Section>
        {body ? (
          <div className="mx-auto mb-14 max-w-3xl">
            <RichText source={body} />
          </div>
        ) : null}
        {menus.length ? (
          <div className="grid gap-8 lg:grid-cols-2">
            {menus.map((menu) => (
              <article key={menu.id} className="rounded-lg bg-surface p-8 shadow-card">
                <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
                  {catalog(`menuCategory.${menu.category}` as "menuCategory.veg")}
                </p>
                <h2 className="text-display-3 mt-2">{t(menu.name, locale)}</h2>
                {menu.description ? <p className="mt-2 text-text-muted">{t(menu.description, locale)}</p> : null}
                <div className="mt-6 space-y-5">
                  {MENU_COURSES.map((course) => {
                    const items = menu.items.filter((i) => i.course === course);
                    if (!items.length) return null;
                    return (
                      <div key={course}>
                        <h3 className="text-sm font-semibold">{catalog(`course.${course}`)}</h3>
                        <ul className="mt-2 space-y-1 text-sm">
                          {items.map((item, index) => (
                            <li key={index}>
                              {t(item.name, locale)}
                              {item.description ? <span className="text-text-muted"> — {t(item.description, locale)}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
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
