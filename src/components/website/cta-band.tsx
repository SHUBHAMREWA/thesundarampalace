import { getTranslations } from "next-intl/server";

import { getPublicContact } from "@/server/cms/queries";

import { ContactActions } from "./contact-actions";
import { Section } from "./section";

/** Closing call-to-action used at the bottom of most pages. */
export async function CtaBand({ locale }: { locale: string }) {
  const [contact, tr] = await Promise.all([getPublicContact(), getTranslations("enquiry")]);
  return (
    <Section tone="deep">
      <div className="flex flex-col items-center gap-6 text-center">
        <span className="gold-rule" aria-hidden="true" />
        <h2 className="text-display-2">{tr("title")}</h2>
        <p className="text-body-lg max-w-xl text-blush">{tr("intro")}</p>
        <ContactActions contact={contact} locale={locale} inverted />
      </div>
    </Section>
  );
}
