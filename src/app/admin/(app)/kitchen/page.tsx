import en from "@messages/en.json";
import { ChefHat, Printer } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { addDays, dateFromKey, dateKey, formatDateKey, formatIST, todayIST } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import type { MenuSnapshot } from "@/server/services/bookings";

export const metadata: Metadata = { title: "Kitchen sheets" };

const COURSES = en.catalog.course as Record<string, string>;

/**
 * Kitchen staff: confirmed functions from today for the next two weeks,
 * menus and plate counts only — no prices, no customer contact details.
 */
export default async function KitchenPage() {
  await requirePermission("kitchen.read");
  const today = todayIST();
  const functions = await db.bookingSubEvent.findMany({
    where: {
      date: { gte: dateFromKey(today), lte: dateFromKey(addDays(today, 14)) },
      booking: { deletedAt: null, status: { in: ["CONFIRMED", "IN_PROGRESS"] } },
      reservation: { state: "CONFIRMED" },
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      name: true,
      date: true,
      startsAt: true,
      endsAt: true,
      expectedGuests: true,
      dietaryNotes: true,
      hall: { select: { name: true } },
      menuSelection: { select: { guaranteedPlates: true, snapshot: true } },
      booking: { select: { id: true, reference: true } },
    },
  });
  return (
    <>
      <PageHeader title="Kitchen sheets" description="Confirmed functions for the next 14 days." crumbs={[{ label: "Kitchen sheets" }]} />
      {functions.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {functions.map((f) => {
            const snap = f.menuSelection?.snapshot as unknown as MenuSnapshot | undefined;
            const courses = new Map<string, string[]>();
            for (const item of snap?.items ?? []) courses.set(item.course, [...(courses.get(item.course) ?? []), item.name]);
            const sheet = new URLSearchParams({ bookingId: f.booking.id, type: "kitchen_sheet", template: "kitchen" });
            for (const field of ["event.main", "event.functions", "event.guests", "menu.items", "notes.special"]) sheet.append("f", field);
            return (
              <Card key={f.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{f.name}</CardTitle>
                    <p className="text-sm">{formatDateKey(dateKey(f.date), "EEE d MMM")} · {formatIST(f.startsAt, "h:mm a")}–{formatIST(f.endsAt, "h:mm a")} · {t(f.hall.name, "en")}</p>
                    <p className="text-xs text-text-muted">{f.booking.reference}</p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/documents/preview?${sheet.toString()}`} target="_blank" rel="noopener">
                      <Printer aria-hidden="true" /> Sheet
                    </a>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 text-base">
                  <p className="text-xl font-semibold">{f.menuSelection ? `${f.menuSelection.guaranteedPlates} plates` : "Menu not chosen yet"}</p>
                  {snap ? <p className="font-medium">{snap.packageName} — {snap.menuName}</p> : null}
                  {[...courses.entries()].map(([course, items]) => (
                    <p key={course}><strong>{COURSES[course] ?? course}:</strong> {items.join(", ")}</p>
                  ))}
                  {f.dietaryNotes ? <p className="rounded-md border border-border p-2"><strong>Dietary notes:</strong> {f.dietaryNotes}</p> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={ChefHat} title="No confirmed functions in the next two weeks" />
      )}
    </>
  );
}
