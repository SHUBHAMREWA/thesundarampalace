import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";

export const metadata: Metadata = { title: "Venues" };

export default async function HallsPage() {
  const halls = await db.hall.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { capacities: true },
  });
  return (
    <>
      <PageHeader
        title="Venues"
        description="Halls and lawns. Enter only verified facts — empty fields show “Details coming soon” on the website."
        actions={
          <Button asChild>
            <Link href="/admin/cms/halls/new">Add venue</Link>
          </Button>
        }
      />
      {halls.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {halls.map((hall) => {
            const missing = [
              !hall.areaSqFt && "area",
              !hall.capacities.length && "capacity",
              !hall.heroAssetId && "photo",
              !hall.floorPlanAssetId && "floor plan",
            ].filter(Boolean);
            return (
              <li key={hall.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <Link href={`/admin/cms/halls/${hall.id}`} className="font-medium text-primary hover:underline">
                    {t(hall.name, "en")}
                  </Link>
                  <p className="text-xs text-text-muted">/venues/{hall.slug}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {missing.length ? <Badge variant="warning">Missing: {missing.join(", ")}</Badge> : null}
                  {hall.published ? <Badge variant="success">Published</Badge> : <Badge variant="secondary">Draft</Badge>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={Building2}
          title="No venues yet"
          description="Add each hall or lawn once the business has supplied its name. Facts can be filled in later."
          action={
            <Button asChild>
              <Link href="/admin/cms/halls/new">Add venue</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
