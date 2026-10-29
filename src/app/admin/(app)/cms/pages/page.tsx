import type { Metadata } from "next";

import { CmsListRow } from "@/components/cms/simple-list";
import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { hasText, t } from "@/lib/i18n/localized";

import { NewServicePageForm } from "./new-service-form";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Website pages" };

const GROUPS = [
  { kind: "STANDARD", title: "Main pages", description: "Header photo, introduction and Google text of these pages. Homepage, Venues, Décor and Gallery are edited from their own tabs." },
  { kind: "SERVICE", title: "Celebrations (service pages)", description: "Each celebration is a title, a description and photos, shown one below the other on the Celebrations page. Click one to edit it or add photos." },
  { kind: "LEGAL", title: "Legal pages", description: "Must be reviewed by a qualified professional before launch." },
] as const;

/**
 * Pages edited from their own tab (its “Page header and intro” / “Google text”
 * button), so they are not listed here twice.
 */
const EDITED_ELSEWHERE = new Set(["home", "venues", "decor", "gallery"]);

export default async function CmsPagesPage() {
  const [pages, placements] = await Promise.all([
    db.websitePage.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.mediaPlacement.findMany({ where: { ownerType: "service_page" }, select: { ownerId: true } }),
  ]);
  const withPhotos = new Set(placements.map((p) => p.ownerId));
  return (
    <>
      <PageHeader title="Website pages" description="Empty pages show a tasteful “coming soon” placeholder on the website." />
      <div className="space-y-6">
        {GROUPS.map((group) => (
          <Card key={group.kind}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
              <p className="text-sm text-text-muted">{group.description}</p>
            </CardHeader>
            <CardContent>
              <ul className="-mx-4 divide-y divide-border">
                {pages
                  .filter((p) => p.kind === group.kind && !(p.kind === "STANDARD" && EDITED_ELSEWHERE.has(p.slug)))
                  .map((page) => (
                    <CmsListRow
                      key={page.id}
                      item={{
                        id: page.id,
                        href: `/admin/cms/pages/${page.id}`,
                        title: t(page.title, "en"),
                        subtitle: page.kind === "SERVICE" ? `/services#${page.slug}` : `/${page.slug}`,
                        live: page.published,
                        // Text, a header photo or gallery photos all count as content.
                        warning:
                          hasText(page.body) || hasText(page.summary) || page.heroAssetId || withPhotos.has(page.id)
                            ? undefined
                            : page.kind === "SERVICE"
                              ? "No photos or text yet"
                              : "Empty — shows the default title only",
                      }}
                    />
                  ))}
              </ul>
              {group.kind === "SERVICE" ? <NewServicePageForm /> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
