import { formatIST } from "@/lib/time";

export type TimelineEntry = { id: string; message: string; actorName: string; createdAt: Date };

/** Activity timeline for customer and booking pages (newest first). */
export function Timeline({ entries, empty = "Nothing has happened yet." }: { entries: TimelineEntry[]; empty?: string }) {
  if (!entries.length) return <p className="text-sm text-text-muted">{empty}</p>;
  return (
    <ol className="space-y-4 border-l border-border pl-5">
      {entries.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2 rounded-full bg-primary" aria-hidden="true" />
          <p className="text-sm whitespace-pre-line">{e.message}</p>
          <p className="text-xs text-text-muted">
            {formatIST(e.createdAt)} · {e.actorName}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Definition list row used on detail pages. */
export function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="break-words">{children ?? "—"}</dd>
    </div>
  );
}
