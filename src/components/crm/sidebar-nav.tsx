"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { cn } from "@/lib/utils";

import { IconChip } from "./icon-chip";
import { activeHref, NAV_GROUPS } from "./nav";

/**
 * Main menus with sub-menus. Renders only the links the server already
 * allowed (`hrefs`). The group holding the current page starts open; others
 * open and close with a click.
 */
export function SidebarNav(props: { hrefs: string[]; onNavigate?: () => void }) {
  // useSearchParams needs a Suspense boundary; the fallback ignores the query string.
  return (
    <Suspense fallback={<Groups {...props} search={new URLSearchParams()} />}>
      <WithSearch {...props} />
    </Suspense>
  );
}

function WithSearch(props: { hrefs: string[]; onNavigate?: () => void }) {
  const search = useSearchParams();
  return <Groups {...props} search={new URLSearchParams(search.toString())} />;
}

function Groups({ hrefs, onNavigate, search }: { hrefs: string[]; onNavigate?: () => void; search: URLSearchParams }) {
  const pathname = usePathname();
  const allowed = new Set(hrefs);
  const groups = NAV_GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => allowed.has(l.href)) })).filter((g) => g.links.length);
  const active = activeHref(hrefs, pathname, search);
  const currentGroup =
    groups.find((g) => g.links.some((l) => l.href === active))?.key ??
    groups.find((g) => g.links.some((l) => pathname.startsWith(l.href.split("?")[0]) && l.href !== "/admin"))?.key;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (key: string) => open[key] ?? key === currentGroup;

  return (
    <nav aria-label="CRM" className="flex flex-col gap-1">
      {groups.map((g) => {
        const here = g.key === currentGroup;
        const expanded = isOpen(g.key);
        const panelId = `nav-${g.key}`;
        return (
          <div key={g.key}>
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setOpen((o) => ({ ...o, [g.key]: !expanded }))}
              className={cn(
                "relative flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                here ? "text-primary before:absolute before:inset-y-2 before:-left-1 before:w-1 before:rounded-full before:bg-primary" : "text-text hover:bg-blush/60",
              )}
            >
              <IconChip icon={g.icon} tone={g.tone} size="sm" className={here ? "bg-primary text-surface" : undefined} />
              <span className="flex-1">{g.label}</span>
              <ChevronDown className={cn("size-4 text-text-muted transition-transform", expanded && "rotate-180")} aria-hidden="true" />
            </button>
            {expanded ? (
              <ul id={panelId} className="mt-0.5 mb-1.5 ml-[1.375rem] space-y-0.5 border-l border-border pl-3">
                {g.links.map((l) => {
                  const current = l.href === active;
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={onNavigate}
                        aria-current={current ? "page" : undefined}
                        className={cn(
                          "block rounded-md px-2 py-1 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                          current ? "bg-blush font-medium text-primary" : "text-text-muted hover:bg-blush/60 hover:text-text",
                        )}
                      >
                        {l.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
