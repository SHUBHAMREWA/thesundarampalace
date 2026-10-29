import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { BookingStatusBadge } from "@/components/crm/status-badge";
import { requireUser } from "@/server/auth/session";
import { quickSearch } from "@/server/services/insights";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  const user = await requireUser();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const { leads, customers, bookings } = await quickSearch(user, q);
  const none = q.length >= 2 && !leads.length && !customers.length && !bookings.length;
  const section = (title: string, items: { id: string; href: string; primary: string; secondary: string; badge?: React.ReactNode }[]) =>
    items.length ? (
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-text-muted uppercase">{title}</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <Link href={i.href} className="font-medium text-primary hover:underline">{i.primary}</Link>
                <p className="text-xs text-text-muted">{i.secondary}</p>
              </div>
              {i.badge}
            </li>
          ))}
        </ul>
      </section>
    ) : null;
  return (
    <>
      <PageHeader title="Search" description={q ? `Results for “${q}”` : "Search by name, phone number or reference."} crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Search" }]} />
      {none ? <p className="text-sm text-text-muted">Nothing found that you have access to.</p> : null}
      {section("Bookings", bookings.map((b) => ({ id: b.id, href: `/admin/bookings/${b.id}`, primary: b.mainEventName, secondary: b.reference, badge: <BookingStatusBadge status={b.status} /> })))}
      {section("Customers", customers.map((c) => ({ id: c.id, href: `/admin/customers/${c.id}`, primary: c.fullName, secondary: c.reference })))}
      {section("Enquiries", leads.map((l) => ({ id: l.id, href: `/admin/leads/${l.id}`, primary: l.fullName, secondary: l.reference })))}
    </>
  );
}
