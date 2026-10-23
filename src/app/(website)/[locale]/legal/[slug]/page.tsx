import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { StandardPage } from "@/components/website/standard-page";
import { LEGAL_PAGES } from "@/lib/content/catalog";
import { metadataForPage } from "@/server/cms/page-metadata";

export function generateStaticParams() {
  return LEGAL_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/[slug]">) {
  const { slug } = await params;
  return metadataForPage("LEGAL", slug, `/legal/${slug}`);
}

/** Legal text must be reviewed by a professional before production (CLAUDE.md). */
export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[slug]">) {
  const { slug } = await params;
  const locale = await currentLocale();
  const tr = await getTranslations("legal");
  return (
    <StandardPage
      kind="LEGAL"
      slug={slug}
      locale={locale}
      placeholder={<p className="text-body-lg mx-auto max-w-2xl text-center text-text-muted">{tr("pending")}</p>}
    />
  );
}
