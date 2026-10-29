import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIST } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { auditQuerySchema, listAudit } from "@/server/services/insights";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  const user = await requirePermission("audit.read");
  const query = auditQuerySchema.parse(await searchParams);
  const { rows, total, pageCount } = await listAudit(user, query);
  const href = (page: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v && k !== "page") p.set(k, String(v));
    if (page > 1) p.set("page", String(page));
    return `/admin/audit?${p.toString()}`;
  };
  return (
    <>
      <PageHeader title="Audit log" description={`${total} entries. Append-only: entries can't be changed or deleted.`} crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Audit log" }]} />
      <form method="get" className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-5">
        <Input name="action" defaultValue={query.action} placeholder="Action, e.g. payment" aria-label="Action" className="bg-surface" />
        <Input name="entity" defaultValue={query.entity} placeholder="Entity type or id" aria-label="Entity" className="bg-surface" />
        <Input name="from" type="date" defaultValue={query.from} aria-label="From date" className="bg-surface" />
        <Input name="to" type="date" defaultValue={query.to} aria-label="To date" className="bg-surface" />
        <div className="flex gap-2"><Button type="submit" size="sm">Filter</Button><Button asChild variant="ghost" size="sm"><Link href="/admin/audit">Clear</Link></Button></div>
      </form>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
        {rows.map((r) => (
          <li key={r.id} className="grid gap-1 p-3 md:grid-cols-[180px_1fr]">
            <span className="text-text-muted">{formatIST(r.createdAt, "d MMM yyyy, h:mm:ss a")}</span>
            <div className="min-w-0">
              <p><strong>{r.action}</strong> · {r.entityType}{r.entityId ? ` ${r.entityId}` : ""} · {r.actorName}{r.ip ? ` · ${r.ip}` : ""}</p>
              {r.summary ? <pre className="mt-1 overflow-x-auto rounded bg-bg p-2 text-xs whitespace-pre-wrap break-all">{JSON.stringify(r.summary)}</pre> : null}
            </div>
          </li>
        ))}
        {rows.length ? null : <li className="p-6 text-center text-text-muted">No entries.</li>}
      </ul>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-text-muted">Page {query.page} of {pageCount}</span>
          {query.page > 1 ? <Button asChild variant="outline" size="sm"><Link href={href(query.page - 1)}>Previous</Link></Button> : null}
          {query.page < pageCount ? <Button asChild variant="outline" size="sm"><Link href={href(query.page + 1)}>Next</Link></Button> : null}
        </nav>
      ) : null}
    </>
  );
}
