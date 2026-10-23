import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { hasText, t } from "@/lib/i18n/localized";

import { NewServicePageForm } from "./new-service-form";

export const metadata: Metadata = { title: "Website pages" };

const GROUPS = [
  { kind: "STANDARD", title: "Main pages", description: "Title, introduction, body text and SEO for each page of the site." },
  { kind: "SERVICE", title: "Celebrations (service pages)", description: "One page per type of event you host." },
  { kind: "LEGAL", title: "Legal pages", description: "Must be reviewed by a qualified professional before launch." },
] as const;

export default async function CmsPagesPage() {
  const pages = await db.websitePage.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] });
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
              <ul className="divide-y divide-border">
                {pages
                  .filter((p) => p.kind === group.kind)
                  .map((page) => (
                    <li key={page.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <Link href={`/admin/cms/pages/${page.id}`} className="font-medium text-primary hover:underline">
                          {t(page.title, "en")}
                        </Link>
                        <p className="text-xs text-text-muted">/{page.slug}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {!hasText(page.body) ? <Badge variant="warning">No content yet</Badge> : null}
                        {!(page.title as { hi?: string }).hi ? <Badge variant="secondary">No Hindi</Badge> : null}
                        {page.published ? <Badge variant="success">Published</Badge> : <Badge variant="secondary">Draft</Badge>}
                      </div>
                    </li>
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
