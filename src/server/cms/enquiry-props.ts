import "server-only";

import { whatsappLink } from "@/lib/contact/links";
import { t } from "@/lib/i18n/localized";

import { getPublicContact, listEventTypes, listHalls } from "./queries";

/** Data the enquiry form needs, resolved for one locale on the server. */
export async function enquiryFormProps(locale: string) {
  const [eventTypes, halls, contact] = await Promise.all([listEventTypes(), listHalls(), getPublicContact()]);
  return {
    eventTypes: eventTypes.map((e) => ({ value: e.key, label: t(e.label, locale) })),
    halls: halls.map((h) => ({ value: h.slug, label: t(h.name, locale) })),
    whatsappHref: contact.whatsapp ? whatsappLink(contact.whatsapp, t(contact.contact.whatsappMessage, locale)) : null,
    responsePromise: t(contact.responseTimePromise, locale) || null,
    contact,
  };
}
