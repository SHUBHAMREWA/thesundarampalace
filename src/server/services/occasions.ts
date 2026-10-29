import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { todayIST } from "@/lib/time";
import { assertPermission, type Actor } from "@/server/policies/authorize";

export type Occasion = { customerId: string; name: string; reference: string; years: number | null };
export type TodaysOccasions = { date: string; birthdays: Occasion[]; anniversaries: Occasion[] };

/** Month-day keys celebrated on `date`; 29 Feb counts on 28 Feb in other years. */
function monthDays(date: string): string[] {
  const [year, md] = [Number(date.slice(0, 4)), date.slice(5)];
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return md === "02-28" && !leap ? ["02-28", "02-29"] : [md];
}

/**
 * Customers whose birthday or wedding anniversary is today (Asia/Kolkata).
 * An anniversary comes from the customer's own anniversary date, or else from
 * the "Wedding" function of one of their confirmed bookings in an earlier year.
 */
export async function todaysOccasions(actor: Actor): Promise<TodaysOccasions> {
  assertPermission(actor, "customers.read");
  const date = todayIST();
  const year = Number(date.slice(0, 4));
  const mds = monthDays(date);
  const active = Prisma.sql`c."deletedAt" IS NULL AND c."anonymizedAt" IS NULL AND c."mergedIntoId" IS NULL`;

  const [birthdays, anniversaries] = await Promise.all([
    db.$queryRaw<{ id: string; fullName: string; reference: string; born: number }[]>`
      SELECT c.id, c."fullName", c.reference, EXTRACT(YEAR FROM c."dateOfBirth")::int AS born
      FROM customer c
      WHERE ${active} AND to_char(c."dateOfBirth", 'MM-DD') IN (${Prisma.join(mds)})
      ORDER BY c."fullName"`,
    db.$queryRaw<{ id: string; fullName: string; reference: string; married: number }[]>`
      SELECT c.id, c."fullName", c.reference, MIN(d.year)::int AS married
      FROM customer c
      JOIN (
        SELECT id AS "customerId", EXTRACT(YEAR FROM anniversary) AS year
        FROM customer
        WHERE to_char(anniversary, 'MM-DD') IN (${Prisma.join(mds)})
        UNION
        SELECT b."customerId", EXTRACT(YEAR FROM s.date) AS year
        FROM booking_sub_event s
        JOIN booking b ON b.id = s."bookingId"
        JOIN lookup_value l ON l."listKey" = 'sub_event_type' AND l.key = s."eventTypeKey" AND l."systemKey" = 'WEDDING'
        WHERE b."deletedAt" IS NULL
          AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
          AND to_char(s.date, 'MM-DD') IN (${Prisma.join(mds)})
      ) d ON d."customerId" = c.id
      WHERE ${active} AND d.year < ${year}
      GROUP BY c.id, c."fullName", c.reference
      ORDER BY c."fullName"`,
  ]);

  return {
    date,
    birthdays: birthdays.map((r) => ({ customerId: r.id, name: r.fullName, reference: r.reference, years: r.born ? year - r.born : null })),
    anniversaries: anniversaries.map((r) => ({ customerId: r.id, name: r.fullName, reference: r.reference, years: year - r.married })),
  };
}
