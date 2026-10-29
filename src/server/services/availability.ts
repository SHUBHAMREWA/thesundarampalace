import "server-only";

import { physicalHallsFor } from "@/lib/booking/rules";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { addDays, isDateKey, istToUtc, todayIST } from "@/lib/time";

import { releaseExpiredHolds } from "./reservations";

/**
 * AVAILABLE: nothing is held or booked in the hall that day.
 * LIMITED: some times are taken — the visitor should enquire with their timing.
 * Holds and confirmed bookings look the same, so nothing about other
 * customers can be inferred (docs/security.md).
 */
export type PublicHallStatus = "AVAILABLE" | "LIMITED";

export type PublicHallAvailability = {
  hallId: string;
  hallSlug: string;
  hallName: string;
  status: PublicHallStatus;
};

export type PublicDateCheckResult = {
  date: string;
  halls: PublicHallAvailability[];
};

/**
 * Public date check. Functions have their own times (there are no fixed
 * slots), so a hall is reported per IST calendar day. Returns only a status
 * per published hall: never references, names, event types or times.
 */
export async function checkPublicDateAvailability(rawDate: string, now: Date = new Date()): Promise<PublicDateCheckResult> {
  const date = isDateKey(rawDate) && rawDate >= todayIST(now) ? rawDate : todayIST(now);
  await releaseExpiredHolds(now);

  const dayStart = istToUtc(date, "00:00");
  const dayEnd = istToUtc(addDays(date, 1), "00:00");
  const [halls, compositions, occupied] = await Promise.all([
    db.hall.findMany({ where: { active: true, published: true }, orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true } }),
    db.hallComposition.findMany({ select: { compositeHallId: true, memberHallId: true } }),
    db.slotOccupancy.findMany({
      where: { state: { in: ["HOLD", "TENTATIVE", "CONFIRMED"] }, effectiveStartsAt: { lt: dayEnd }, effectiveEndsAt: { gt: dayStart } },
      select: { physicalHallId: true },
    }),
  ]);
  const busy = new Set(occupied.map((o) => o.physicalHallId));

  return {
    date,
    halls: halls.map((hall) => ({
      hallId: hall.id,
      hallSlug: hall.slug,
      hallName: t(hall.name, "en"),
      status: physicalHallsFor(hall.id, compositions).some((id) => busy.has(id)) ? "LIMITED" : "AVAILABLE",
    })),
  };
}
