import { MapPin } from "lucide-react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { directionsUrl } from "@/lib/contact/map";
import { getPublicContact } from "@/server/cms/queries";

import { LanguageToggle } from "./language-toggle";
import { MobileSiteNav } from "./mobile-site-nav";
import { SITE_NAV } from "./nav-items";
import { SiteNavLink } from "./site-nav-link";

const NAV_LINK = "rounded-md px-3 py-2 text-sm font-medium text-text hover:bg-blush/60 hover:text-primary";
const NAV_LINK_ACTIVE = "bg-blush text-primary underline decoration-accent decoration-2 underline-offset-8";

export async function SiteHeader() {
  const [site, nav, cta, contact] = await Promise.all([
    getTranslations("site"),
    getTranslations("nav"),
    getTranslations("cta"),
    getPublicContact(),
  ]);
  const directions = directionsUrl(contact);
  const items = SITE_NAV.map((item) => ({ href: item.href, label: nav(item.key) }));
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="font-display text-xl font-semibold whitespace-nowrap text-primary sm:text-2xl">
          {site("name")}
        </Link>
        <nav aria-label={nav("primary")} className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => (
              <li key={item.href}>
                {/* The current page's item is highlighted; the fallback (no path yet) shows it plain. */}
                <Suspense
                  fallback={
                    <Link href={item.href} className={NAV_LINK}>
                      {item.label}
                    </Link>
                  }
                >
                  <SiteNavLink href={item.href} className={NAV_LINK} activeClassName={NAV_LINK_ACTIVE}>
                    {item.label}
                  </SiteNavLink>
                </Suspense>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          {/* Phones: a map pin to the venue instead of the language switch. */}
          <div className="hidden sm:block">
            <Suspense fallback={<div className="h-8 w-14" />}>
              <LanguageToggle />
            </Suspense>
          </div>
          {directions ? (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={cta("directions")}
              title={cta("directions")}
              className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-blush/60 sm:hidden"
            >
              <MapPin className="size-5" aria-hidden="true" />
            </a>
          ) : null}
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/plan-your-event">{cta("planEvent")}</Link>
          </Button>
          <MobileSiteNav
            items={items}
            planLabel={cta("planEvent")}
            menuLabel={site("menu")}
            title={site("name")}
          />
        </div>
      </Container>
    </header>
  );
}
