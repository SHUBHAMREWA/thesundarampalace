import { Bell } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { db } from "@/lib/db";
import { formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/session";

import { PushToggle } from "@/components/crm/push-toggle";
import { env } from "@/lib/env";

import { MarkReadButton } from "./mark-read";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up"}
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Notifications" }]}
        actions={unread ? <MarkReadButton notificationId={null} label="Mark all as read" /> : null}
      />
      <div className="mb-6">
        <PushToggle publicKey={env().NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      </div>
      {notifications.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {notifications.map((n) => (
            <li key={n.id} className={cn("flex items-start gap-4 p-4", !n.readAt && "bg-blush/30")}>
              <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                {n.link ? (
                  <Link href={n.link} className="font-medium text-primary hover:underline">
                    {n.title}
                  </Link>
                ) : (
                  <p className="font-medium">{n.title}</p>
                )}
                {n.body ? <p className="text-sm text-text-muted">{n.body}</p> : null}
                <p className="mt-1 text-xs text-text-muted">{formatIST(n.createdAt)}</p>
              </div>
              {!n.readAt ? <MarkReadButton notificationId={n.id} label="Mark read" /> : <span className="sr-only">Read</span>}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Bell} title="No notifications yet" description="New enquiries and assignments will show up here." />
      )}
    </>
  );
}
