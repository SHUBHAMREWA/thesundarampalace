import { currentLocale } from "@/i18n/current";

import { StandardPage } from "@/components/website/standard-page";
import { metadataForPage } from "@/server/cms/page-metadata";
import { listPages } from "@/server/cms/queries";

export async function generateStaticParams() {
  const services = await listPages("SERVICE");
  return services.length ? services.map((s) => ({ slug: s.slug })) : [{ slug: "weddings" }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/services/[slug]">) {
  const { slug } = await params;
  return metadataForPage("SERVICE", slug, `/services/${slug}`);
}

export default async function ServicePage({ params }: PageProps<"/[locale]/services/[slug]">) {
  const { slug } = await params;
  const locale = await currentLocale();
  return <StandardPage kind="SERVICE" slug={slug} locale={locale} />;
}
