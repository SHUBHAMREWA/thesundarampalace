import { notFound } from "next/navigation";

import { RichText } from "@/lib/content/rich-text";
import { t } from "@/lib/i18n/localized";
import { getPage, type PageView } from "@/server/cms/queries";

import { ContentPlaceholder } from "./content-placeholder";
import { CtaBand } from "./cta-band";
import { PageHero } from "./page-hero";
import { Section } from "./section";

/** CMS page: hero band, body text (or a placeholder), closing call to action. */
export async function StandardPage({
  kind,
  slug,
  locale,
  eyebrow,
  placeholder,
}: {
  kind: PageView["kind"];
  slug: string;
  locale: string;
  eyebrow?: string;
  /** Rendered instead of the generic placeholder when the body is empty. */
  placeholder?: React.ReactNode;
}) {
  const page = await getPage(kind, slug);
  if (!page) notFound();
  const body = t(page.body, locale);
  return (
    <>
      <PageHero
        title={t(page.title, locale)}
        summary={t(page.summary, locale)}
        eyebrow={eyebrow}
        hero={page.hero}
        locale={locale}
      />
      <Section>
        {body ? (
          <article className="mx-auto max-w-3xl">
            <RichText source={body} />
          </article>
        ) : (
          (placeholder ?? <ContentPlaceholder />)
        )}
      </Section>
      {kind !== "LEGAL" ? <CtaBand locale={locale} /> : null}
    </>
  );
}
