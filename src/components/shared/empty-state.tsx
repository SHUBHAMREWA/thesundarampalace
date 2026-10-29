import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { IconChip, type Tone } from "@/components/crm/icon-chip";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "rose",
}: {
  icon?: LucideIcon;
  tone?: Tone;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      {Icon ? <IconChip icon={Icon} tone={tone} size="lg" /> : null}
      <h2 className="mt-3 text-base font-semibold">{title}</h2>
      {description ? <p className="mt-1 max-w-md text-sm text-text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
