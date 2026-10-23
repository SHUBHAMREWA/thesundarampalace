import { CalendarClock, Hourglass, Wallet } from "lucide-react";
import Link from "next/link";

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
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="rounded-lg border border-border bg-surface p-5 transition-colors hover:border-primary">
            <div className="flex items-center justify-between text-text-muted">
              <span className="text-sm">{label}</span>
              <Icon className="size-4" aria-hidden="true" />
            </div>
            <p className="mt-2 text-3xl font-semibold">{value}</p>
          </Link>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Coming up</CardTitle></CardHeader>
        <CardContent>
          {upcoming.length ? (
            <ul className="divide-y divide-border">
              {upcoming.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/admin/bookings/${f.booking.id}`} className="font-medium text-primary hover:underline">{f.name}</Link>
                  <span className="text-text-muted">{formatDateKey(dateKey(f.date), "EEE d MMM")} · {formatIST(f.startsAt, "h:mm a")} · {t(f.hall.name, "en")} · {f.booking.reference}</span>
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
