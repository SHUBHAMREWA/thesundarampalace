import { CalendarClock, Hourglass, Wallet } from "lucide-react";
import Link from "next/link";

import { StatGrid, StatTile } from "@/components/crm/stat-tile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { allocateToInstalments, ledgerTotals } from "@/lib/money";
import { t } from "@/lib/i18n/localized";
import { addDays, dateFromKey, dateKey, formatDateKey, formatIST, todayIST } from "@/lib/time";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { bookingVisibility } from "@/server/services/bookings";
import { releaseExpiredHolds } from "@/server/services/reservations";

/** Instalments due today or earlier that the ledger has not covered yet. */
async function unpaidDueInstalments(visible: Prisma.BookingWhereInput, today: string): Promise<number> {
  const bookings = await db.booking.findMany({
    where: { AND: [visible, { status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] } }, { instalments: { some: { dueOn: { lte: dateFromKey(today) } } } }] },
    select: { instalments: true, ledger: { select: { type: true, direction: true, amount: true } } },
    take: 200,
  });
  let count = 0;
  for (const b of bookings) {
    const schedule = allocateToInstalments(
      ledgerTotals(b.ledger).netReceived,
      b.instalments.map((i) => ({ id: i.id, label: i.label, dueOn: dateKey(i.dueOn), amount: i.amount })),
      today,
    );
    count += schedule.filter((s) => s.dueOn <= today && s.status !== "PAID").length;
  }
  return count;
}

/**
 * Dashboard section for roles that work with bookings. Counts come from real
 * records only; holds and tentatives are never counted as confirmed.
 */
export async function BookingPanel({ user }: { user: CurrentUser }) {
  await releaseExpiredHolds();
  const today = todayIST();
  const visible = bookingVisibility(user);
  const now = new Date();
  const soon = new Date(now.getTime() + 24 * 3_600_000);
  const [upcoming, holdsExpiring, dueInstalments] = await Promise.all([
    db.bookingSubEvent.findMany({
      where: { date: { gte: dateFromKey(today), lte: dateFromKey(addDays(today, 7)) }, booking: { AND: [visible, { status: { in: ["CONFIRMED", "IN_PROGRESS"] } }] } },
      orderBy: { startsAt: "asc" },
      take: 10,
      select: { id: true, name: true, date: true, startsAt: true, hall: { select: { name: true } }, booking: { select: { id: true, reference: true } } },
    }),
    db.slotReservation.count({ where: { state: "HOLD", waitlistPosition: null, holdExpiresAt: { lte: soon }, subEvent: { booking: visible } } }),
    can(user, "payments.read") ? unpaidDueInstalments(visible, today) : Promise.resolve(null),
  ]);
  const tiles = [
    { label: "Confirmed functions, next 7 days", value: upcoming.length, icon: CalendarClock, href: "/admin/calendar" },
    { label: "Holds expiring within 24 h", value: holdsExpiring, icon: Hourglass, href: "/admin/bookings?status=ENQUIRY_HOLD" },
    ...(dueInstalments !== null ? [{ label: "Instalments due or overdue", value: dueInstalments, icon: Wallet, href: "/admin/bookings?status=CONFIRMED" }] : []),
  ];
  return (
    <div className="space-y-6">
      <StatGrid half>
        {tiles.map(({ label, value, icon, href }, i) => (
          <StatTile key={label} label={label} value={value} icon={icon} href={href} tone={i + 3} />
        ))}
      </StatGrid>
      <Card>
        <CardHeader><CardTitle>Coming up</CardTitle></CardHeader>
        <CardContent>
          {upcoming.length ? (
            /* Same look as a confirmed entry on the calendar. */
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/admin/bookings/${f.booking.id}`}
                    className="group flex items-stretch gap-3 rounded-lg bg-primary p-2 text-sm text-primary-foreground transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[var(--shadow-card)]"
                  >
                    <span className="flex w-12 shrink-0 flex-col items-center justify-center rounded-md bg-surface/15 py-1 leading-none">
                      <span className="text-[10px] uppercase opacity-80">{formatDateKey(dateKey(f.date), "EEE")}</span>
                      <span className="text-lg font-semibold">{formatDateKey(dateKey(f.date), "d")}</span>
                      <span className="text-[10px] uppercase opacity-80">{formatDateKey(dateKey(f.date), "MMM")}</span>
                    </span>
                    <span className="min-w-0 py-0.5">
                      <span className="block truncate font-medium">{f.name}</span>
                      <span className="block text-xs opacity-85">{formatIST(f.startsAt, "h:mm a")} · {t(f.hall.name, "en")}</span>
                      <span className="block text-xs opacity-70">{f.booking.reference}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No confirmed functions in the next week.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
