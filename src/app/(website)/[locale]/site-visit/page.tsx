import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo/metadata";
import { currentLocale } from "@/i18n/current";

import { Container } from "@/components/layout/container";
import { PageHero } from "@/components/website/page-hero";
import { SiteVisitForm } from "@/components/website/site-visit-form";
import { t } from "@/lib/i18n/localized";
import { listHalls } from "@/server/cms/queries";

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    locale: await currentLocale(),
    path: "/site-visit",
    title: "Book a Site Visit",
    description: "Schedule an in-person guided tour of our grand banquet halls and luxury venue spaces.",
  });
}

export default async function SiteVisitPage() {
  const locale = await currentLocale();
  const rawHalls = await listHalls();

  const halls = rawHalls.map((h) => ({
    id: h.slug,
    slug: h.slug,
    name: t(h.name, locale),
  }));

  const isHindi = locale === "hi";

  return (
    <>
      <PageHero
        title={isHindi ? "स्थल भ्रमण बुक करें" : "Book a Site Visit"}
        summary={
          isHindi
            ? "द सुंदरम पैलेस के भव्य हॉल्स, मंडप और डाइनिंग क्षेत्रों का व्यक्तिगत अवलोकन करें।"
            : "Schedule an in-person guided tour of our wedding venue, banquet halls, and lush lawns."
        }
        locale={locale}
      />
      <section className="py-16 md:py-24">
        <Container>
          <SiteVisitForm halls={halls} locale={locale} />
        </Container>
      </section>
    </>
  );
}
