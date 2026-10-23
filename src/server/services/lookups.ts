import "server-only";

import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";

export type LookupOption = { value: string; label: string; systemKey: string | null };

/** Active values of a configurable list, in display order (English labels for the CRM). */
export async function lookupOptions(listKey: string): Promise<LookupOption[]> {
  const rows = await db.lookupValue.findMany({
    where: { listKey, active: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((r) => ({ value: r.key, label: t(r.label, "en") || r.key, systemKey: r.systemKey }));
}

export function labelOf(options: LookupOption[], key: string | null | undefined): string {
  if (!key) return "—";
  return options.find((o) => o.value === key)?.label ?? key;
}
