import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { currentLocale } from "@/i18n/current";

import "../../globals.css";
import { fontVariables } from "../../fonts";
import { FloatingWhatsApp } from "@/components/website/floating-whatsapp";
import { SiteFooter } from "@/components/website/site-footer";
import { SiteHeader } from "@/components/website/site-header";
import { UtmCapture } from "@/components/website/utm-capture";
import { routing } from "@/i18n/routing";
import { whatsappLink } from "@/lib/contact/links";
import { env } from "@/lib/env";
import { t } from "@/lib/i18n/localized";
import { getPublicContact } from "@/server/cms/queries";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getTranslations("home");
  return {
    metadataBase: new URL(env().NEXT_PUBLIC_SITE_URL),
    title: { default: tr("metaTitle"), template: "%s · The Sundaram Palace" },
    description: tr("metaDescription"),
  };
}

export default async function WebsiteLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await currentLocale();
  const [tr, cta, contact] = await Promise.all([
    getTranslations("site"),
    getTranslations("cta"),
    getPublicContact(),
  ]);
  return (
    <html lang={locale} className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2"
        >
          {tr("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <UtmCapture />
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter locale={locale} />
          {contact.whatsapp ? (
            <FloatingWhatsApp
              href={whatsappLink(contact.whatsapp, t(contact.contact.whatsappMessage, locale))}
              label={cta("whatsapp")}
            />
          ) : null}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
