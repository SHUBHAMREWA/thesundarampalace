import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n/localized";
import { addDays, dateKey, formatDateKey, formatIST, todayIST } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Actor } from "@/server/policies/authorize";
import { calendarBookings, calendarEntries } from "@/server/services/bookings";

/** Visual states (design-system.md): confirmed solid, tentative outlined, hold dashed, waitlist muted. */
function stateClass(state: string | undefined, waitlisted: boolean) {
  if (waitlisted) return "border border-dashed border-border-strong text-text-muted";
  switch (state) {
    case "CONFIRMED":
      return "bg-primary text-primary-foreground";
    case "TENTATIVE":
      return "border border-warning text-warning bg-surface";
    case "HOLD":
      return "border border-dashed border-info text-info bg-surface";
    default:
      return "border border-border text-text-muted line-through";
  }
}

const LEGEND = [
  { label: "Booked", state: "CONFIRMED", waitlisted: false },
  { label: "Not booked yet", state: "TENTATIVE", waitlisted: false },
  { label: "Hold", state: "HOLD", waitlisted: false },
  { label: "Waitlist", state: "HOLD", waitlisted: true },
  { label: "Released", state: "RELEASED", waitlisted: false },
];

/** "2026-10" from a search param, or the current IST month. */
export function monthParam(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? value : todayIST().slice(0, 7);
}

/**
 * Month grid of functions, used by the Calendar page and the dashboard.
 * `basePath` is where the month arrows link (`?month=YYYY-MM` is added).
 */
export async function MonthCalendar({ user, month, basePath, compact = false }: { user: Actor; month: string; basePath: string; compact?: boolean }) {
  const today = todayIST();
  const first = `${month}-01`;
  const nextMonth = addDays(first, 32).slice(0, 7);
  const prevMonth = addDays(first, -1).slice(0, 7);
  const last = addDays(`${nextMonth}-01`, -1);
  // Weeks start on Monday.
  const firstWeekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -firstWeekday);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const [entries, bookings] = await Promise.all([calendarEntries(user, days[0], days[41]), calendarBookings(user, days[0], days[41])]);
  const byDay = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = dateKey(e.date);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }
  // Each day of a booking's event dates shows the booking, unless one of its functions is already listed that day.
  const bookingsOn = (day: string) =>
    bookings.filter((b) => day >= b.from && day <= b.to && !(byDay.get(day) ?? []).some((e) => e.booking.id === b.id));
  const bookingState = (status: string) =>
    status === "CONFIRMED" || status === "IN_PROGRESS" || status === "COMPLETED" ? "CONFIRMED" : "TENTATIVE";
  const href = (m: string) => `${basePath}?month=${m}`;
  const monthEntries = entries.filter((e) => dateKey(e.date) >= first && dateKey(e.date) <= last);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm"><Link href={href(prevMonth)} aria-label="Previous month" scroll={false}><ChevronLeft aria-hidden="true" /></Link></Button>
        <Button asChild variant="outline" size="sm"><Link href={href(today.slice(0, 7))} scroll={false}>Today</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href={href(nextMonth)} aria-label="Next month" scroll={false}><ChevronRight aria-hidden="true" /></Link></Button>
        <p className="font-medium text-primary-deep">{formatDateKey(first, "MMMM yyyy")}</p>
        <ul className="ml-auto flex flex-wrap gap-2 text-xs" aria-label="Legend">
          {LEGEND.map((l) => (
            <li key={l.label} className={cn("rounded px-2 py-0.5", stateClass(l.state, l.waitlisted))}>{l.label}</li>
          ))}
        </ul>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
        <div className="grid grid-cols-7 border-b border-border bg-bg text-xs font-medium text-text-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-2 py-1.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = day >= first && day <= last;
            const items = byDay.get(day) ?? [];
            return (
              <div key={day} className={cn("border-r border-b border-border p-1.5 [&:nth-child(7n)]:border-r-0", compact ? "min-h-16" : "min-h-28", !inMonth && "bg-bg", day === today && "bg-blush/40")}>
                <p className={cn("mb-1 text-xs", day === today ? "inline-flex size-5 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground" : inMonth ? "" : "text-text-muted")}>{Number(day.slice(8))}</p>
                <ul className="space-y-1">
                  {bookingsOn(day).map((b) => (
                    <li key={b.id}>
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className={cn("block truncate rounded px-1.5 py-0.5 text-xs transition-opacity hover:opacity-85", stateClass(bookingState(b.status), false))}
                        title={`${b.reference} · ${b.mainEventName}`}
                      >
                        {b.mainEventName}
                      </Link>
                    </li>
                  ))}
                  {items.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/admin/bookings/${e.booking.id}`}
                        className={cn("block truncate rounded px-1.5 py-0.5 text-xs transition-opacity hover:opacity-85", stateClass(e.reservation?.state, !!e.reservation?.waitlistPosition))}
                        title={`${e.booking.reference} · ${e.name} · ${t(e.hall.name, "en")} · ${formatIST(e.startsAt, "h:mm a")}–${formatIST(e.endsAt, "h:mm a")}`}
                      >
                        {formatIST(e.startsAt, "h:mma").toLowerCase()} {e.name}{compact ? "" : ` · ${t(e.hall.name, "en")}`}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {bookings
          .filter((b) => b.to >= first && b.from <= last && !monthEntries.some((e) => e.booking.id === b.id))
          .map((b) => (
            <Link key={b.id} href={`/admin/bookings/${b.id}`} className={cn("block rounded-lg p-3 text-sm", stateClass(bookingState(b.status), false))}>
              <p className="font-medium">{b.from === b.to ? formatDateKey(b.from, "EEE d MMM") : `${formatDateKey(b.from, "d MMM")} – ${formatDateKey(b.to, "d MMM")}`}</p>
              <p>{b.mainEventName}</p>
              <p className="text-xs opacity-80">{b.reference}</p>
            </Link>
          ))}
        {monthEntries.length || bookings.some((b) => b.to >= first && b.from <= last) ? (
          monthEntries.map((e) => (
            <Link key={e.id} href={`/admin/bookings/${e.booking.id}`} className={cn("block rounded-lg p-3 text-sm", stateClass(e.reservation?.state, !!e.reservation?.waitlistPosition))}>
              <p className="font-medium">{formatDateKey(dateKey(e.date), "EEE d MMM")} · {formatIST(e.startsAt, "h:mm a")}</p>
              <p>{e.name} · {t(e.hall.name, "en")}</p>
              <p className="text-xs opacity-80">{e.booking.reference}{e.booking.customer ? ` · ${e.booking.customer.fullName}` : ""}</p>
            </Link>
          ))
        ) : (
          <p className="text-sm text-text-muted">Nothing booked this month.</p>
        )}
      </div>
    </div>
  );
}
