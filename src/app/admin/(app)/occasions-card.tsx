"use client";

import { Cake, Heart, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { IconChip } from "@/components/crm/icon-chip";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { todaysOccasionsAction } from "@/server/actions/customers";
import type { Occasion, TodaysOccasions } from "@/server/services/occasions";

/*
 * Today's list is fetched once per day per staff member and kept in this
 * browser's IndexedDB, so opening the dashboard again does not query the
 * server. Only names, references and the number of years are stored, and
 * yesterday's entry is removed. The refresh button fetches it again (e.g.
 * after adding a date of birth today).
 */
const DB_NAME = "sundaram-crm";
const STORE = "occasions";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCache(key: string): Promise<TodaysOccasions | null> {
  const db = await openDb();
  return new Promise((resolve) => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as TodaysOccasions | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

async function writeCache(key: string, value: TodaysOccasions) {
  const db = await openDb();
  const store = db.transaction(STORE, "readwrite").objectStore(STORE);
  store.clear(); // only today's list is kept
  store.put(value, key);
}

export function OccasionsCard({ userId }: { userId: string }) {
  const [data, setData] = useState<TodaysOccasions | null>(null);
  const [open, setOpen] = useState<"birthdays" | "anniversaries" | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(
    (fresh: boolean) =>
      startTransition(async () => {
        const key = `${userId}:${todayKey()}`;
        try {
          const cached = fresh ? null : await readCache(key).catch(() => null);
          if (cached) return setData(cached);
          const result = await todaysOccasionsAction();
          setData(result);
          setFailed(false);
          await writeCache(`${userId}:${result.date}`, result).catch(() => undefined);
        } catch {
          setFailed(true);
        }
      }),
    [userId],
  );

  useEffect(() => load(false), [load]);

  const rows: { key: "birthdays" | "anniversaries"; label: string; icon: typeof Cake; tone: "rose" | "gold" }[] = [
    { key: "birthdays", label: "Birthdays today", icon: Cake, tone: "rose" },
    { key: "anniversaries", label: "Anniversaries today", icon: Heart, tone: "gold" },
  ];
  const list = open && data ? data[open] : [];

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Wish them today</p>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={pending}
            aria-label="Refresh birthdays and anniversaries"
            className="rounded-md p-1.5 text-text-muted hover:bg-primary/5 hover:text-primary disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {rows.map(({ key, label, icon, tone }) => {
            const count = data?.[key].length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setOpen(open === key ? null : key)}
                aria-expanded={open === key}
                disabled={!count}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors enabled:hover:border-primary/60",
                  open === key ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <IconChip icon={icon} tone={tone} size="sm" />
                <span>
                  <span className="block text-2xl leading-none font-semibold tracking-tight">{count ?? "–"}</span>
                  <span className="mt-1 block text-xs text-text-muted">{label}</span>
                </span>
              </button>
            );
          })}
        </div>
        {failed ? <p className="text-xs text-danger">Couldn’t load today’s birthdays and anniversaries. Try refresh.</p> : null}
        {list.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {list.map((o: Occasion) => (
              <li key={o.customerId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <Link href={`/admin/customers/${o.customerId}`} className="min-w-0 truncate font-medium text-primary hover:underline">
                  {o.name}
                </Link>
                <span className="shrink-0 text-xs text-text-muted">
                  {o.years ? (open === "birthdays" ? `Turns ${o.years}` : `${o.years} year${o.years === 1 ? "" : "s"}`) : o.reference}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
