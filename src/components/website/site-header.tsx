import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

import { LanguageToggle } from "./language-toggle";
import { MobileSiteNav } from "./mobile-site-nav";
import { SITE_NAV } from "./nav-items";

export async function SiteHeader() {
  const [site, nav, cta] = await Promise.all([
    getTranslations("site"),
    getTranslations("nav"),
    getTranslations("cta"),
  ]);
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
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-text hover:bg-blush/60 hover:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <LanguageToggle />
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
