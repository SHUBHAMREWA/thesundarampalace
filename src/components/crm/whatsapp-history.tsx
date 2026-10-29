import Link from "next/link";

import { MessageStatusBadge } from "@/components/crm/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIST } from "@/lib/time";
import { cn } from "@/lib/utils";

type Entry = { id: string; direction: "in" | "out"; at: Date; text: string; status: string | null; error: string | null };

/** WhatsApp messages with one customer or lead, newest first (from the message log). */
export function WhatsAppHistory({ entries }: { entries: Entry[] | null }) {
  if (!entries) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>WhatsApp messages</CardTitle>
        <Link href="/admin/messages" className="text-sm text-text-muted hover:text-primary">
          All messages
        </Link>
      </CardHeader>
      <CardContent>
        {entries.length ? (
          <ul className="space-y-3 text-sm">
            {entries.map((m) => (
              <li key={m.id} className={cn("max-w-[85%] rounded-lg border p-3", m.direction === "out" ? "ml-auto border-border bg-blush" : "border-border bg-surface")}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span>
                    {m.direction === "out" ? "Sent" : "Received"} {formatIST(m.at, "d MMM yyyy, h:mm a")}
                  </span>
                  {m.status ? <MessageStatusBadge status={m.status} /> : null}
                </div>
                {m.error && m.status !== "SENT" && m.status !== "DELIVERED" && m.status !== "READ" ? <p className="mt-1 text-xs text-danger">{m.error}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">No WhatsApp messages yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
