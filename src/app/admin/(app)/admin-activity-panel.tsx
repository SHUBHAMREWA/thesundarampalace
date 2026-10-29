import { Activity } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatIST } from "@/lib/time";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";

/**
 * Admin recent activities panel (MASTER_PROMPT §16).
 * Shows latest audit log entries for Super Admin, Admin, and Managers.
 */
export async function AdminActivityPanel({ user }: { user: CurrentUser }) {
  if (!can(user, "audit.read")) return null;

  const recentLogs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      actorId: true,
    },
  });

  const actorIds = [...new Set(recentLogs.map((l) => l.actorId).filter((id): id is string => !!id))];
  const users = actorIds.length
    ? await db.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true },
      })
    : [];
  const actorMap = new Map(users.map((u) => [u.id, u.name]));

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5 text-primary" aria-hidden="true" />
            Recent administrative activity
          </CardTitle>
          <p className="text-xs text-text-muted">Recorded audit actions across the CRM.</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/audit">Full audit log</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {recentLogs.length ? (
          <ul className="divide-y divide-border">
            {recentLogs.map((log) => {
              const actorName = log.actorId ? actorMap.get(log.actorId) ?? "Staff" : "System";
              return (
                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      <span className="font-semibold text-primary">{actorName}</span> · {log.action}
                    </p>
                    <p className="text-xs text-text-muted">
                      {log.entityType} {log.entityId ? `(${log.entityId.slice(0, 8)}…)` : ""}
                    </p>
                  </div>
                  <span className="text-xs text-text-muted">{formatIST(log.createdAt, "d MMM, h:mm a")}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No activity records found.</p>
        )}
      </CardContent>
    </Card>
  );
}
