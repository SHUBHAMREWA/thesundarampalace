import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { MessageStatusBadge } from "@/components/crm/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/db";
import { formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/validation/phone";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { listCampaigns, listMessages, listReplies, MESSAGE_STATUSES, messageQuerySchema } from "@/server/services/whatsapp/campaigns";
import { whatsAppSettingsView } from "@/server/services/whatsapp/config";

import { SendRemaining } from "./send-remaining";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "WhatsApp" };

const VIEWS = [
  { value: "log", label: "Sent messages" },
  { value: "replies", label: "Replies" },
  { value: "campaigns", label: "Campaigns" },
] as const;

const selectClass = "h-9 rounded-md border border-border bg-surface px-2 text-sm";

function personLink(type: string | null, id: string | null, name: string | null) {
  if (!type || !id || !name) return null;
  return (
    <Link href={type === "customer" ? `/admin/customers/${id}` : `/admin/leads/${id}`} className="font-medium hover:text-primary">
      {name}
    </Link>
  );
}

/** WhatsApp message logs: what was sent to whom and when, what happened to it, and replies. */
export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  const user = await requirePermission("messages.read");
  const params = await searchParams;
  const view = VIEWS.find((v) => v.value === params.view)?.value ?? "log";
  const query = messageQuerySchema.parse(params);
  const [settings, waiting] = await Promise.all([
    whatsAppSettingsView(),
    db.outbox.count({ where: { channel: "whatsapp", status: { in: ["PENDING", "NOT_SENT_NO_PROVIDER"] }, attempts: { lt: 5 } } }),
  ]);
  const canSend = can(user, "messages.send");

  const href = (changes: Record<string, string | number | null>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...query, view, ...changes })) if (v && !(k === "page" && v === 1) && !(k === "view" && v === "log")) p.set(k, String(v));
    const qs = p.toString();
    return `/admin/messages${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="WhatsApp"
        description="Every WhatsApp message the CRM sends, its delivery status, and customer replies."
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "WhatsApp" }]}
        actions={
          <div className="flex flex-wrap gap-2">
            {canSend && waiting > 0 && settings.ready ? <SendRemaining count={waiting} /> : null}
            {canSend ? (
              <Button asChild size="sm">
                <Link href="/admin/messages/new">New bulk message</Link>
              </Button>
            ) : null}
          </div>
        }
      />
      {!settings.ready ? (
        <Alert variant="warning" className="mb-6">
          <AlertDescription>
            WhatsApp is not connected, so nothing is being sent.{" "}
            {can(user, "settings.manage") ? (
              <Link href="/admin/settings#whatsapp" className="underline">
                Add and test the API keys in Settings.
              </Link>
            ) : (
              "Ask an administrator to connect it in Settings."
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      <nav aria-label="WhatsApp views" className="mb-4 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link
            key={v.value}
            href={v.value === "log" ? "/admin/messages" : `/admin/messages?view=${v.value}`}
            aria-current={v.value === view ? "page" : undefined}
            className={cn("rounded-md border px-3 py-1.5 text-sm", v.value === view ? "border-primary bg-blush text-primary" : "border-border bg-surface hover:border-primary")}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "campaigns" ? <Campaigns user={user} /> : null}

      {view !== "campaigns" ? (
        <form method="get" className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-6">
          {view === "replies" ? <input type="hidden" name="view" value="replies" /> : null}
          {query.campaign ? <input type="hidden" name="campaign" value={query.campaign} /> : null}
          <Input name="q" defaultValue={query.q} placeholder="Phone number" aria-label="Phone number" className="bg-surface" />
          {view === "log" ? (
            <select name="status" defaultValue={query.status} aria-label="Status" className={selectClass}>
              <option value="">All statuses</option>
              {MESSAGE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : null}
          <Input name="from" type="date" defaultValue={query.from} aria-label="From date" className="bg-surface" />
          <Input name="to" type="date" defaultValue={query.to} aria-label="To date" className="bg-surface" />
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Filter
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href={view === "replies" ? "/admin/messages?view=replies" : "/admin/messages"}>Clear</Link>
            </Button>
          </div>
        </form>
      ) : null}

      {view === "log" ? <Log user={user} query={query} href={href} /> : null}
      {view === "replies" ? <Replies user={user} query={query} href={href} /> : null}
    </>
  );
}

type Props = {
  user: Awaited<ReturnType<typeof requirePermission>>;
  query: ReturnType<typeof messageQuerySchema.parse>;
  href: (changes: Record<string, string | number | null>) => string;
};

function Pager({ page, pageCount, href }: { page: number; pageCount: number; href: Props["href"] }) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center gap-2 text-sm">
      <span className="text-text-muted">
        Page {page} of {pageCount}
      </span>
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href({ page: page - 1 })}>Previous</Link>
        </Button>
      ) : null}
      {page < pageCount ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href({ page: page + 1 })}>Next</Link>
        </Button>
      ) : null}
    </nav>
  );
}

async function Log({ user, query, href }: Props) {
  const { rows, total, pageCount } = await listMessages(user, query);
  const campaign = query.campaign ? rows[0]?.campaign?.name : null;
  if (!rows.length) return <EmptyState icon={MessageCircle} title="No messages" description="Messages appear here as soon as they are queued." />;
  return (
    <>
      <p className="mb-2 text-sm text-text-muted">
        {total} messages{campaign ? ` in “${campaign}”` : ""}
        {query.campaign ? (
          <>
            {" · "}
            <Link href={href({ campaign: null, page: 1 })} className="underline">
              show all
            </Link>
          </>
        ) : null}
      </p>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
        {rows.map((m) => (
          <li key={m.id} className="grid gap-2 p-3 md:grid-cols-[170px_1fr_auto]">
            <div className="text-text-muted">
              <p>{formatIST(m.createdAt, "d MMM yyyy, h:mm a")}</p>
              <p className="text-xs">{m.campaign ? m.campaign.name : m.purpose === "test" ? "Test message" : m.purpose}</p>
            </div>
            <div className="min-w-0 space-y-1">
              <p>
                {personLink(m.relatedType, m.relatedId, m.name) ?? <span className="font-medium">Unknown</span>} · {maskPhone(m.toAddress)} · <span className="text-text-muted">{m.template}</span>
              </p>
              <p className="line-clamp-2 whitespace-pre-wrap text-text-muted">{m.text}</p>
              {m.lastError && m.status !== "SENT" && m.status !== "DELIVERED" && m.status !== "READ" ? <p className="text-xs text-danger">{m.lastError}</p> : null}
            </div>
            <div className="space-y-1 text-xs text-text-muted md:text-right">
              <MessageStatusBadge status={m.status} />
              {m.sentAt ? <p>Sent {formatIST(m.sentAt, "d MMM, h:mm a")}</p> : null}
              {m.deliveredAt ? <p>Delivered {formatIST(m.deliveredAt, "d MMM, h:mm a")}</p> : null}
              {m.readAt ? <p>Read {formatIST(m.readAt, "d MMM, h:mm a")}</p> : null}
              {m.failedAt && m.status === "FAILED" ? <p>Failed {formatIST(m.failedAt, "d MMM, h:mm a")}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      <Pager page={query.page} pageCount={pageCount} href={href} />
    </>
  );
}

async function Replies({ user, query, href }: Props) {
  const { rows, pageCount } = await listReplies(user, query);
  if (!rows.length) return <EmptyState icon={MessageCircle} title="No replies yet" description="Messages customers send to the business number appear here once the webhook is set up." />;
  return (
    <>
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface text-sm">
        {rows.map((m) => (
          <li key={m.id} className="grid gap-2 p-3 md:grid-cols-[170px_1fr]">
            <p className="text-text-muted">{formatIST(m.receivedAt, "d MMM yyyy, h:mm a")}</p>
            <div className="min-w-0 space-y-1">
              <p>
                {personLink(m.relatedType, m.relatedId, m.name) ?? <span className="font-medium">Not in the CRM</span>} · {maskPhone(m.fromAddress)}
              </p>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <Pager page={query.page} pageCount={pageCount} href={href} />
    </>
  );
}

async function Campaigns({ user }: { user: Props["user"] }) {
  const campaigns = await listCampaigns(user);
  if (!campaigns.length) return <EmptyState icon={MessageCircle} title="No campaigns yet" description="Use “New bulk message” to send an approved template to customers or leads." />;
  return (
    <ul className="space-y-3">
      {campaigns.map((c) => {
        const n = (s: string) => c.byStatus[s] ?? 0;
        const stats = [
          ["Waiting", n("PENDING") + n("NOT_SENT_NO_PROVIDER")],
          ["Sent", n("SENT")],
          ["Delivered", n("DELIVERED")],
          ["Read", n("READ")],
          ["Failed", n("FAILED")],
          ["Skipped", n("SKIPPED_NO_CONSENT")],
        ] as const;
        return (
          <li key={c.id} className="rounded-lg border border-border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-text-muted">
                  {formatIST(c.createdAt, "d MMM yyyy, h:mm a")}
                  {c.createdBy ? ` · by ${c.createdBy}` : ""} · template {c.templateName} ({c.templateCategory.toLowerCase()}) · {c.recipientCount} people
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/messages?campaign=${c.id}`}>See messages</Link>
              </Button>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {stats.map(([label, value]) => (
                <div key={label} className="rounded border border-border p-2 text-center">
                  <dt className="text-xs text-text-muted">{label}</dt>
                  <dd className="text-base font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
