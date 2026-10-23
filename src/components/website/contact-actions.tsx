import { MessageCircle, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { telLink, whatsappLink } from "@/lib/contact/links";
import { t } from "@/lib/i18n/localized";
import type { PublicContact } from "@/server/cms/queries";

import { TrackedLink } from "./tracked-link";

/**
 * "Plan your event" plus WhatsApp and call buttons — the latter two appear
 * only once the business has entered those numbers (no dead buttons).
 */
export async function ContactActions({
  contact,
  locale,
  inverted = false,
  showPlan = true,
}: {
  contact: PublicContact;
  locale: string;
  inverted?: boolean;
  showPlan?: boolean;
}) {
  const tr = await getTranslations("cta");
  const message = t(contact.contact.whatsappMessage, locale);
  const secondary = inverted
    ? "border-primary-foreground/60 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
    : "";
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {showPlan ? (
        <Button asChild size="lg" className={inverted ? "bg-surface text-primary hover:bg-blush" : ""}>
          <Link href="/plan-your-event">{tr("planEvent")}</Link>
        </Button>
      ) : null}
      {contact.whatsapp ? (
        <Button asChild size="lg" variant="outline" className={secondary}>
          <TrackedLink
            conversion="whatsapp_click"
            href={whatsappLink(contact.whatsapp, message)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" />
            {tr("whatsapp")}
          </TrackedLink>
        </Button>
      ) : null}
      {contact.phone ? (
        <Button asChild size="lg" variant="outline" className={secondary}>
          <TrackedLink conversion="call_click" href={telLink(contact.phone)}>
            <Phone aria-hidden="true" />
            {tr("call")}
          </TrackedLink>
        </Button>
      ) : null}
    </div>
  );
}
