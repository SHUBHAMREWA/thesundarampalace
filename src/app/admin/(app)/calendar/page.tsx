import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { nativeSelectClass } from "@/components/forms/form-kit";
import { PageHeader } from "@/components/crm/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { addDays, dateKey, formatDateKey, formatIST, todayIST } from "@/lib/time";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth/session";
import { calendarEntries } from "@/server/services/bookings";

export const metadata: Metadata = { title: "Calendar" };

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
  { label: "Confirmed", state: "CONFIRMED", waitlisted: false },
  { label: "Tentative / quotation sent", state: "TENTATIVE", waitlisted: false },
  { label: "Hold", state: "HOLD", waitlisted: false },
  { label: "Waitlist", state: "HOLD", waitlisted: true },
  { label: "Released", state: "RELEASED", waitlisted: false },
];

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  const user = await requirePermission("bookings.read");
  const params = await searchParams;
  const today = todayIST();
  const month = typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month) ? params.month : today.slice(0, 7);
  const hallId = typeof params.hall === "string" ? params.hall : "";
  const first = `${month}-01`;
  const nextMonth = addDays(first, 32).slice(0, 7);
  const prevMonth = addDays(first, -1).slice(0, 7);
  const last = addDays(`${nextMonth}-01`, -1);
  // Weeks start on Monday.
  const firstWeekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -firstWeekday);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const [entries, halls] = await Promise.all([
    calendarEntries(user, days[0], days[41], hallId || undefined),
    db.hall.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const byDay = new Map<string, typeof entries>();
  for (const e of entries) {
    const key = dateKey(e.date);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }
  const href = (m: string) => `/admin/calendar?month=${m}${hallId ? `&hall=${hallId}` : ""}`;
  const monthEntries = entries.filter((e) => dateKey(e.date) >= first && dateKey(e.date) <= last);

  return (
    <>
      <PageHeader title="Calendar" description={formatDateKey(first, "MMMM yyyy")} crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Calendar" }]} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline" size="sm"><Link href={href(prevMonth)} aria-label="Previous month"><ChevronLeft aria-hidden="true" /></Link></Button>
        <Button asChild variant="outline" size="sm"><Link href={href(today.slice(0, 7))}>Today</Link></Button>
        <Button asChild variant="outline" size="sm"><Link href={href(nextMonth)} aria-label="Next month"><ChevronRight aria-hidden="true" /></Link></Button>
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="month" value={month} />
          <label htmlFor="hall" className="sr-only">Hall</label>
          <select id="hall" name="hall" defaultValue={hallId} className={nativeSelectClass}>
            <option value="">All halls</option>
            {halls.map((h) => (
              <option key={h.id} value={h.id}>{t(h.name, "en")}</option>
            ))}
          </select>
          <Button type="submit" size="sm">Show</Button>
        </form>
        <ul className="ml-auto flex flex-wrap gap-2 text-xs" aria-label="Legend">
          {LEGEND.map((l) => (
            <li key={l.label} className={cn("rounded px-2 py-0.5", stateClass(l.state, l.waitlisted))}>{l.label}</li>
          ))}
        </ul>
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border bg-surface md:block">
        <div className="grid grid-cols-7 border-b border-border text-xs font-medium text-text-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-2 py-1.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = day >= first && day <= last;
            const items = byDay.get(day) ?? [];
            return (
              <div key={day} className={cn("min-h-28 border-r border-b border-border p-1.5 last:border-r-0", !inMonth && "bg-bg")}>
                <p className={cn("mb-1 text-xs", day === today ? "font-bold text-primary" : inMonth ? "" : "text-text-muted")}>{Number(day.slice(8))}</p>
                <ul className="space-y-1">
                  {items.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/admin/bookings/${e.booking.id}`}
                        className={cn("block truncate rounded px-1.5 py-0.5 text-xs", stateClass(e.reservation?.state, !!e.reservation?.waitlistPosition))}
                        title={`${e.booking.reference} · ${e.name} · ${t(e.hall.name, "en")} · ${formatIST(e.startsAt, "h:mm a")}–${formatIST(e.endsAt, "h:mm a")}`}
                      >
                        {formatIST(e.startsAt, "h:mma").toLowerCase()} {e.name} · {t(e.hall.name, "en")}
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
        {monthEntries.length ? (
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
    </>
  );
}
