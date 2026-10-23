import { money, roundMoney } from "@/lib/money";

/**
 * Differences between two quotation versions, for the "what changed" view.
 * Lines are matched by kind + function + description.
 */
export type DiffLine = {
  kind: string;
  subEventLabel: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
};

export type LineChange =
  | { type: "added"; line: DiffLine }
  | { type: "removed"; line: DiffLine }
  | { type: "changed"; before: DiffLine; after: DiffLine; fields: ("quantity" | "unitPrice" | "lineTotal")[] };

function key(line: DiffLine) {
  return `${line.kind}|${line.subEventLabel ?? ""}|${line.description.trim().toLowerCase()}`;
}

export function diffQuotationLines(before: DiffLine[], after: DiffLine[]): LineChange[] {
  const remaining = new Map<string, DiffLine[]>();
  for (const line of before) remaining.set(key(line), [...(remaining.get(key(line)) ?? []), line]);
  const changes: LineChange[] = [];
  for (const line of after) {
    const candidates = remaining.get(key(line));
    const match = candidates?.shift();
    if (!match) {
      changes.push({ type: "added", line });
      continue;
    }
    const fields = (["quantity", "unitPrice", "lineTotal"] as const).filter((f) => !money(match[f]).equals(money(line[f])));
    if (fields.length) changes.push({ type: "changed", before: match, after: line, fields });
  }
  for (const lines of remaining.values()) for (const line of lines) changes.push({ type: "removed", line });
  return changes;
}

export function totalDelta(beforeTotal: string, afterTotal: string): string {
  return roundMoney(money(afterTotal).minus(money(beforeTotal))).toFixed(2);
}
