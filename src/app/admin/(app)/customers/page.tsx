import { Contact, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ConfirmAction } from "@/components/crm/action-kit";
import { nativeSelectClass } from "@/components/forms/form-kit";
import { PageHeader } from "@/components/crm/page-header";
import {
  PersonAvatar,
  TonePill,
  toneFor,
} from "@/components/crm/person-avatar";
import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPhoneForDisplay, whatsappLink } from "@/lib/contact/links";
import { formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";
import { deleteCustomerAction } from "@/server/actions/customers";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import {
  customerListQuerySchema,
  listCustomers,
} from "@/server/services/customers";
import { labelOf, lookupOptions } from "@/server/services/lookups";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Customers" };

/** Round, tinted icon button for table rows. */
const ROW_BUTTON =
  "inline-flex size-8 items-center justify-center rounded-full transition-colors";

export default async function CustomersPage({
  searchParams,
}: PageProps<"/admin/customers">) {
  const user = await requirePermission("customers.read");
  const query = customerListQuerySchema.parse(await searchParams);
  const [{ rows, total, pageCount }, categories] = await Promise.all([
    listCustomers(user, query),
    lookupOptions("customer_category"),
  ]);
  const filtered = Boolean(query.q || query.category);
  const canEdit = can(user, "customers.edit");
  const canDelete = can(user, "customers.delete");
  const canDeleteBookings = can(user, "bookings.delete");
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
        crumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Customers" },
        ]}
        actions={
          <>
            {can(user, "customers.merge") ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/customers/duplicates">
                  Possible duplicates
                </Link>
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
      <form
        method="get"
        role="search"
        className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-4"
      >
        <div className="relative md:col-span-2">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 size-4 text-text-muted"
            aria-hidden="true"
          />
          <label htmlFor="q" className="sr-only">
            Search by name, mobile or reference
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={query.q}
            placeholder="Name, mobile or SP-C-…"
            className="bg-surface pl-9"
          />
        </div>
        <label htmlFor="category" className="sr-only">
          Category
        </label>
        <select
          id="category"
          name="category"
          defaultValue={query.category ?? ""}
          className={nativeSelectClass}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button type="submit" size="sm">
            Search
          </Button>
          {filtered ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/customers">Clear</Link>
            </Button>
          ) : null}
        </div>
      </form>
      {rows.length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-card)]">
          <Table>
            <TableHeader>
              <TableRow className="bg-bg hover:bg-bg">
                <TableHead className="text-xs tracking-wide text-text-muted uppercase">
                  Customer
                </TableHead>
                <TableHead className="hidden text-xs tracking-wide text-text-muted uppercase md:table-cell">
                  Category
                </TableHead>
                <TableHead className="hidden text-xs tracking-wide text-text-muted uppercase sm:table-cell">
                  City
                </TableHead>
                <TableHead className="hidden text-xs tracking-wide text-text-muted uppercase md:table-cell">
                  Bookings
                </TableHead>
                <TableHead className="hidden text-xs tracking-wide text-text-muted uppercase lg:table-cell">
                  Added
                </TableHead>
                <TableHead className="text-right text-xs tracking-wide text-text-muted uppercase">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className="hover:bg-blush/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={c.fullName} />
                      <div className="min-w-0">
                        <Link
                          href={`/admin/customers/${c.id}`}
                          className="font-medium text-text hover:text-primary"
                        >
                          {c.fullName}
                        </Link>
                        <div className="text-xs text-text-muted">
                          {c.reference} · {formatPhoneForDisplay(c.mobile)}
                          {c.companyName ? ` · ${c.companyName}` : ""}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {c.categoryKey ? (
                      <TonePill tone={toneFor(c.categoryKey)}>
                        {labelOf(categories, c.categoryKey)}
                      </TonePill>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {c.city ?? <span className="text-text-muted">—</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <TonePill tone={c._count.bookings ? "green" : "plum"}>
                      {c._count.bookings}
                    </TonePill>
                  </TableCell>
                  <TableCell className="hidden text-sm text-text-muted lg:table-cell">
                    {formatIST(c.createdAt, "d MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      <a
                        href={whatsappLink(
                          c.whatsapp || c.mobile,
                          `Namaste ${c.fullName.split(" ")[0]},`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Chat with ${c.fullName} on WhatsApp`}
                        title="Chat on WhatsApp"
                        className={cn(
                          ROW_BUTTON,
                          "bg-whatsapp/10 text-whatsapp hover:bg-whatsapp/20",
                        )}
                      >
                        <WhatsAppIcon className="size-4" />
                      </a>
                      {canEdit ? (
                        <Link
                          href={`/admin/customers/${c.id}?edit=1#edit`}
                          aria-label={`Edit ${c.fullName}`}
                          title="Edit"
                          className={cn(
                            ROW_BUTTON,
                            "bg-info/10 text-info hover:bg-info/20",
                          )}
                        >
                          <Pencil className="size-4" aria-hidden="true" />
                        </Link>
                      ) : null}
                      {canDelete &&
                      (c.bookings.length > 0 ||
                        (c._count.bookings > 0 && !canDeleteBookings)) ? (
                        <span
                          className={cn(
                            ROW_BUTTON,
                            "cursor-not-allowed bg-danger/5 text-danger/40",
                          )}
                          role="img"
                          aria-label={`Can't delete ${c.fullName}`}
                          title={
                            c.bookings.length
                              ? `Can't delete: booking ${c.bookings[0].reference} is confirmed. Cancel it first.`
                              : "Can't delete: you aren't allowed to delete their bookings."
                          }
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </span>
                      ) : null}
                      {canDelete &&
                      c.bookings.length === 0 &&
                      (c._count.bookings === 0 || canDeleteBookings) ? (
                        <ConfirmAction
                          action={deleteCustomerAction.bind(null, c.id)}
                          label={`Delete ${c.fullName}`}
                          triggerContent={
                            <Trash2 className="size-4" aria-hidden="true" />
                          }
                          triggerClassName={cn(
                            ROW_BUTTON,
                            "bg-danger/10 p-0 text-danger hover:bg-danger/20",
                          )}
                          title={`Delete ${c.fullName}?`}
                          description={
                            c._count.bookings
                              ? `Their ${c._count.bookings} booking${c._count.bookings === 1 ? " is" : "s are"} deleted too and the halls become free. Bookings with unrefunded money stop the delete. The audit log keeps who deleted it and why.`
                              : "The customer disappears from the CRM. The audit log keeps who deleted it and why."
                          }
                          confirmLabel="Delete customer"
                          reasonName="reason"
                          reasonLabel="Why?"
                          reasonRequired
                          destructive
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={Contact}
          title={filtered ? "No customers match" : "No customers yet"}
          description={
            filtered
              ? "Try another name or number."
              : "Convert a lead or add a customer to start a booking."
          }
        />
      )}
      {pageCount > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-6 flex items-center justify-between text-sm"
        >
          <span className="text-text-muted">
            Page {query.page} of {pageCount}
          </span>
          <div className="flex gap-2">
            {query.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(query.page - 1)}>Previous</Link>
              </Button>
            ) : null}
            {query.page < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={pageHref(query.page + 1)}>Next</Link>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
