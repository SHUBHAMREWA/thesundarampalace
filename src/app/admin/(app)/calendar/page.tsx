import type { Metadata } from "next";

import { MonthCalendar, monthParam } from "@/components/crm/month-calendar";
import { PageHeader } from "@/components/crm/page-header";
import { requirePermission } from "@/server/auth/session";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  const user = await requirePermission("bookings.read");
  const month = monthParam((await searchParams).month);
  return (
    <>
      <PageHeader title="Calendar" crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Calendar" }]} />
      <MonthCalendar user={user} month={month} basePath="/admin/calendar" />
    </>
  );
}
