"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CMS_SECTIONS } from "@/components/crm/nav";
import { cn } from "@/lib/utils";


export function CmsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Website CMS" className="-mx-4 mb-6 overflow-x-auto border-b border-border px-4 md:-mx-8 md:px-8">
      <ul className="flex gap-1">
        {CMS_SECTIONS.map((s) => {
          const active = pathname.startsWith(s.href);
          return (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
                  active ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text",
                )}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
