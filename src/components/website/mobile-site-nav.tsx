"use client";

import { Menu } from "lucide-react";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

import { MenuLanguageSwitch } from "./menu-language-switch";
import { SiteNavLink } from "./site-nav-link";

export function MobileSiteNav({
  items,
  planLabel,
  menuLabel,
  title,
}: {
  items: { href: string; label: string }[];
  planLabel: string;
  menuLabel: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="xl:hidden" aria-label={menuLabel}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 bg-surface">
        <SheetHeader>
          <SheetTitle className="font-display text-xl text-primary">{title}</SheetTitle>
        </SheetHeader>
        <nav aria-label={menuLabel} className="px-4">
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.href}>
                <SiteNavLink
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 text-base font-medium hover:bg-blush/60"
                  activeClassName="bg-blush text-primary"
                >
                  {item.label}
                </SiteNavLink>
              </li>
            ))}
          </ul>
          <Button asChild className="mt-6 w-full">
            <Link href="/plan-your-event" onClick={() => setOpen(false)}>
              {planLabel}
            </Link>
          </Button>
          <Suspense fallback={null}>
            <MenuLanguageSwitch onSelect={() => setOpen(false)} />
          </Suspense>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
