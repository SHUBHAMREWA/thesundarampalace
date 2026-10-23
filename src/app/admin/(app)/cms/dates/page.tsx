import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { formatIST } from "@/lib/time";

import { AddDateForm, DeleteDateButton } from "./date-forms";

export const metadata: Metadata = { title: "Popular dates" };

export default async function DatesPage() {
  const dates = await db.auspiciousDate.findMany({ orderBy: { date: "asc" } });
  return (
    <>
      <PageHeader
        title="Popular wedding dates"
        description="Dates the business supplies (e.g. popular muhurat dates). The website never calculates these itself."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Add a date</CardTitle></CardHeader>
          <CardContent><AddDateForm /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Dates ({dates.length})</CardTitle></CardHeader>
          <CardContent>
            {dates.length ? (
              <ul className="divide-y divide-border">
                {dates.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <p className="font-medium">{formatIST(d.date, "EEE d MMM yyyy")}</p>
                      <p className="text-sm text-text-muted">{t(d.label, "en")}</p>
                    </div>
                    <DeleteDateButton id={d.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">No dates yet. The homepage section stays hidden until you add some.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
