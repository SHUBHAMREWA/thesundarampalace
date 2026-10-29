"use client";

import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** True when the page is this nav item or one of its sub-pages (e.g. /blog/some-post). */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A main-menu link that is highlighted while the visitor is on its page. */
export function SiteNavLink({
  href,
  className,
  activeClassName,
  onClick,
  children,
}: {
  href: string;
  className: string;
  activeClassName: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const active = isActivePath(usePathname(), href);
  return (
    <Link href={href} onClick={onClick} aria-current={active ? "page" : undefined} className={cn(className, active && activeClassName)}>
      {children}
    </Link>
  );
}
