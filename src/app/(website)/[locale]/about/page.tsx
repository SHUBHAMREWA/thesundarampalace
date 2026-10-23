import { currentLocale } from "@/i18n/current";

import { StandardPage } from "@/components/website/standard-page";
import { metadataForPage } from "@/server/cms/page-metadata";

export const generateMetadata = () => metadataForPage("STANDARD", "about", "/about");

export default async function AboutPage() {
  const locale = await currentLocale();
  return <StandardPage kind="STANDARD" slug="about" locale={locale} />;
}
