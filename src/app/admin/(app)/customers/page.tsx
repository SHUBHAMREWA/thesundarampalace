import { Contact, Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { nativeSelectClass } from "@/components/forms/form-kit";
import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPhoneForDisplay } from "@/lib/contact/links";
import { formatIST } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { customerListQuerySchema, listCustomers } from "@/server/services/customers";
import { labelOf, lookupOptions } from "@/server/services/lookups";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const user = await requirePermission("customers.read");
  const query = customerListQuerySchema.parse(await searchParams);
  const [{ rows, total, pageCount }, categories] = await Promise.all([listCustomers(user, query), lookupOptions("customer_category")]);
  const filtered = Boolean(query.q || query.category);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.category) params.set("category", query.category);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return `/admin/customers${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Customers"
        description={`${total} ${total === 1 ? "customer" : "customers"}${filtered ? " match" : ""}`}
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Customers" }]}
        actions={
          <>
            {can(user, "customers.merge") ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/customers/duplicates">Possible duplicates</Link>
              </Button>
            ) : null}
            {can(user, "customers.edit") ? (
              <Button asChild size="sm">
                <Link href="/admin/customers/new">
                  <Plus aria-hidden="true" /> New customer
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <form method="get" role="search" className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-text-muted" aria-hidden="true" />
          <label htmlFor="q" className="sr-only">Search by name, mobile or reference</label>
          <Input id="q" name="q" defaultValue={query.q} placeholder="Name, mobile or SP-C-…" className="bg-surface pl-9" />
        </div>
        <label htmlFor="category" className="sr-only">Category</label>
        <select id="category" name="category" defaultValue={query.category ?? ""} className={nativeSelectClass}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button type="submit" size="sm">Search</Button>
          {filtered ? (
            <Button asChild variant="ghost" size="sm"><Link href="/admin/customers">Clear</Link></Button>
          ) : null}
        </div>
      </form>
      {rows.length ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden sm:table-cell">City</TableHead>
                <TableHead className="hidden md:table-cell">Bookings</TableHead>
                <TableHead className="hidden lg:table-cell">Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/admin/customers/${c.id}`} className="font-medium text-primary hover:underline">{c.fullName}</Link>
                    <div className="text-xs text-text-muted">{c.reference} · {formatPhoneForDisplay(c.mobile)}{c.companyName ? ` · ${c.companyName}` : ""}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{labelOf(categories, c.categoryKey)}</TableCell>
                  <TableCell className="hidden sm:table-cell">{c.city ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">{c._count.bookings}</TableCell>
                  <TableCell className="hidden text-sm text-text-muted lg:table-cell">{formatIST(c.createdAt, "d MMM yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={Contact}
          title={filtered ? "No customers match" : "No customers yet"}
          description={filtered ? "Try another name or number." : "Convert a lead or add a customer to start a booking."}
        />
      )}
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-text-muted">Page {query.page} of {pageCount}</span>
          <div className="flex gap-2">
            {query.page > 1 ? <Button asChild variant="outline" size="sm"><Link href={pageHref(query.page - 1)}>Previous</Link></Button> : null}
            {query.page < pageCount ? <Button asChild variant="outline" size="sm"><Link href={pageHref(query.page + 1)}>Next</Link></Button> : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
