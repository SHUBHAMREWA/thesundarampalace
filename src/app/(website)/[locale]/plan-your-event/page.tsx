import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { Container } from "@/components/layout/container";
import { EnquiryForm } from "@/components/website/enquiry-form";
import { StepsEnquiryForm } from "@/components/website/hall-from-query";
import { PageHero } from "@/components/website/page-hero";
import { formatPhoneForDisplay, telLink } from "@/lib/contact/links";
import { t } from "@/lib/i18n/localized";
import { enquiryFormProps } from "@/server/cms/enquiry-props";
import { metadataForPage } from "@/server/cms/page-metadata";
import { getPage } from "@/server/cms/queries";

export const generateMetadata = () => metadataForPage("STANDARD", "plan-your-event", "/plan-your-event");

export default async function PlanYourEventPage() {
  const locale = await currentLocale();
  const [page, props, tr] = await Promise.all([
    getPage("STANDARD", "plan-your-event"),
    enquiryFormProps(locale),
    getTranslations("enquiry"),
  ]);
  const { contact, ...formProps } = props;
  const contactLine = contact.phone ? (
    <>
      {tr("contactDirect")} <a href={telLink(contact.phone)} className="underline">{formatPhoneForDisplay(contact.phone)}</a>
    </>
  ) : undefined;

  return (
    <>
      <PageHero
        title={t(page?.title, locale) || tr("title")}
        summary={t(page?.summary, locale) || tr("intro")}
        hero={page?.hero}
        locale={locale}
      />
      <section className="bg-blush/40 py-12 md:py-20">
        <Container className="max-w-2xl">
          {/* The ?hall= preselection reads the URL, so it renders in its own boundary. */}
          <Suspense fallback={<EnquiryForm variant="steps" {...formProps} contactLine={contactLine} />}>
            <StepsEnquiryForm {...formProps} contactLine={contactLine} />
          </Suspense>
        </Container>
      </section>
    </>
  );
}
