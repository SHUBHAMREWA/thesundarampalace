import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** List screen shared by menus, décor themes and packages. */
export function SimpleCmsList({
  title,
  description,
  newHref,
  newLabel,
  icon,
  emptyText,
  items,
}: {
  title: string;
  description: string;
  newHref: string;
  newLabel: string;
  icon: LucideIcon;
  emptyText: string;
  items: { id: string; href: string; title: string; subtitle?: string; live: boolean; liveLabel?: string; warning?: string }[];
}) {
  const action = (
    <Button asChild>
      <Link href={newHref}>{newLabel}</Link>
    </Button>
  );
  return (
    <>
      <PageHeader title={title} description={description} actions={action} />
      {items.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 p-4">
              <div>
                <Link href={item.href} className="font-medium text-primary hover:underline">
                  {item.title}
                </Link>
                {item.subtitle ? <p className="text-xs text-text-muted">{item.subtitle}</p> : null}
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                {item.warning ? <Badge variant="warning">{item.warning}</Badge> : null}
                {item.live ? <Badge variant="success">{item.liveLabel ?? "Published"}</Badge> : <Badge variant="secondary">Draft</Badge>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={icon} title={emptyText} action={action} />
      )}
    </>
  );
}
