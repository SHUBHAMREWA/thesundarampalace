import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/container";
import { Link } from "@/i18n/navigation";
import { formatPhoneForDisplay, telLink } from "@/lib/contact/links";
import { t } from "@/lib/i18n/localized";
import { getPublicContact, listPages } from "@/server/cms/queries";

import { SITE_NAV } from "./nav-items";

export async function SiteFooter({ locale }: { locale: string }) {
  const [tr, nav, contact, legalPages] = await Promise.all([
    getTranslations(),
    getTranslations("nav"),
    getPublicContact(),
    listPages("LEGAL"),
  ]);
  const social = [
    { href: contact.contact.instagramUrl, label: "Instagram" },
    { href: contact.contact.facebookUrl, label: "Facebook" },
    { href: contact.contact.youtubeUrl, label: "YouTube" },
  ].filter((s): s is { href: string; label: string } => !!s.href);

  return (
    <footer className="bg-primary-deep pt-16 pb-10 text-sm text-blush">
      <Container>
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl text-primary-foreground">{tr("site.name")}</p>
            <span className="gold-rule mt-3" aria-hidden="true" />
            <div className="mt-5 space-y-1">
              {contact.address ? <p>{contact.address}</p> : null}
              {contact.phone ? (
                <p>
                  <a href={telLink(contact.phone)} className="hover:text-primary-foreground">
                    {formatPhoneForDisplay(contact.phone)}
                  </a>
                </p>
              ) : null}
              {contact.email ? (
                <p>
                  <a href={`mailto:${contact.email}`} className="hover:text-primary-foreground">
                    {contact.email}
                  </a>
                </p>
              ) : null}
              {!contact.address && !contact.phone && !contact.email ? <p>{tr("placeholder.contact")}</p> : null}
            </div>
            {social.length ? (
              <ul className="mt-5 flex gap-4">
                {social.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <nav aria-label={tr("footer.explore")}>
            <p className="font-medium text-primary-foreground">{tr("footer.explore")}</p>
            <ul className="mt-4 grid grid-cols-2 gap-2">
              {SITE_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-primary-foreground">
                    {nav(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label={tr("footer.legal")}>
            <p className="font-medium text-primary-foreground">{tr("footer.legal")}</p>
            <ul className="mt-4 space-y-2">
              {legalPages.map((page) => (
                <li key={page.slug}>
                  <Link href={`/legal/${page.slug}`} className="hover:text-primary-foreground">
                    {t(page.title, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-12 border-t border-primary-foreground/15 pt-6 text-center text-xs">
          © {tr("site.name")}. {tr("footer.rights")}
        </p>
      </Container>
    </footer>
  );
}
