import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import { Container } from "@/components/layout/container";
import { ContactActions } from "@/components/website/contact-actions";
import { EnquiryForm } from "@/components/website/enquiry-form";
import { JsonLd } from "@/components/website/json-ld";
import { PageHero } from "@/components/website/page-hero";
import { formatPhoneForDisplay, telLink, whatsappLink } from "@/lib/contact/links";
import { RichText } from "@/lib/content/rich-text";
import { env } from "@/lib/env";
import { t } from "@/lib/i18n/localized";
import { eventVenueJsonLd } from "@/lib/seo/structured-data";
import { enquiryFormProps } from "@/server/cms/enquiry-props";
import { metadataForPage } from "@/server/cms/page-metadata";
import { getPage } from "@/server/cms/queries";

export const generateMetadata = () => metadataForPage("STANDARD", "contact", "/contact");

/** Only Google Maps embed URLs are rendered in the iframe. */
function isMapEmbed(url: string): boolean {
  return /^https:\/\/(www\.)?google\.com\/maps\/embed\?/.test(url);
}

export default async function ContactPage() {
  const locale = await currentLocale();
  const [page, props, tr, ph, cta] = await Promise.all([
    getPage("STANDARD", "contact"),
    enquiryFormProps(locale),
    getTranslations("contact"),
    getTranslations("placeholder"),
    getTranslations("cta"),
  ]);
  const { contact, ...formProps } = props;
  const directions = t(contact.contact.directions, locale);
  const hasDetails = contact.address || contact.phone || contact.email || contact.whatsapp;
  const mapUrl = contact.contact.mapEmbedUrl && isMapEmbed(contact.contact.mapEmbedUrl) ? contact.contact.mapEmbedUrl : null;

  return (
    <>
      <JsonLd
        data={eventVenueJsonLd({
          name: contact.displayName,
          url: `${env().NEXT_PUBLIC_SITE_URL}/${locale}/contact`,
          telephone: contact.phone,
          email: contact.email,
          streetAddress: contact.address,
          city: contact.city,
          sameAs: [contact.contact.instagramUrl, contact.contact.facebookUrl, contact.contact.youtubeUrl],
        })}
      />
      <PageHero title={t(page?.title, locale) || "Contact"} summary={t(page?.summary, locale)} hero={page?.hero} locale={locale} />
      <section className="py-16 md:py-24">
        <Container className="grid gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            {hasDetails ? (
              <ul className="space-y-5">
                {contact.address ? (
                  <li className="flex gap-4">
                    <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-sm text-text-muted">{tr("address")}</p>
                      <p className="text-body-lg">{contact.address}</p>
                    </div>
                  </li>
                ) : null}
                {contact.phone ? (
                  <li className="flex gap-4">
                    <Phone className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-sm text-text-muted">{tr("phone")}</p>
                      <a href={telLink(contact.phone)} className="text-body-lg hover:text-primary">
                        {formatPhoneForDisplay(contact.phone)}
                      </a>
                    </div>
                  </li>
                ) : null}
                {contact.whatsapp ? (
                  <li className="flex gap-4">
                    <MessageCircle className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-sm text-text-muted">{tr("whatsapp")}</p>
                      <a
                        href={whatsappLink(contact.whatsapp, t(contact.contact.whatsappMessage, locale))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-body-lg hover:text-primary"
                      >
                        {formatPhoneForDisplay(contact.whatsapp)}
                      </a>
                    </div>
                  </li>
                ) : null}
                {contact.email ? (
                  <li className="flex gap-4">
                    <Mail className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-sm text-text-muted">{tr("email")}</p>
                      <a href={`mailto:${contact.email}`} className="text-body-lg hover:text-primary">
                        {contact.email}
                      </a>
                    </div>
                  </li>
                ) : null}
                {contact.officeHours ? (
                  <li className="flex gap-4">
                    <Clock className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <div>
                      <p className="text-sm text-text-muted">{tr("hours")}</p>
                      <p className="text-body-lg">{contact.officeHours}</p>
                    </div>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="text-body-lg text-text-muted">{ph("contact")}</p>
            )}

            <ContactActions contact={contact} locale={locale} showPlan={false} />

            {directions ? (
              <div>
                <h2 className="text-display-3">{tr("directions")}</h2>
                <div className="mt-3">
                  <RichText source={directions} className="space-y-3" />
                </div>
              </div>
            ) : null}

            {mapUrl ? (
              <div className="overflow-hidden rounded-lg shadow-card">
                <iframe
                  src={mapUrl}
                  title={tr("map")}
                  className="aspect-[4/3] w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            ) : null}
            {contact.contact.mapLink ? (
              <a href={contact.contact.mapLink} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-primary underline underline-offset-4">
                {cta("directions")}
              </a>
            ) : null}
          </div>

          <div>
            <h2 className="text-display-3 mb-6">{tr("quickEnquiry")}</h2>
            <EnquiryForm variant="compact" {...formProps} />
          </div>
        </Container>
      </section>
    </>
  );
}
