import { ImageIcon, Pencil, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";

export type CmsListItem = {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  live: boolean;
  liveLabel?: string;
  warning?: string;
  /** Cloudinary public ID of the first photo; shows a small thumbnail when set. */
  thumb?: string | null;
};

/**
 * One row of a CMS list: the whole row opens the editor, and an explicit
 * "Edit" button makes that obvious.
 */
export function CmsListRow({ item, showThumb = false }: { item: CmsListItem; showThumb?: boolean }) {
  return (
    <li className="group relative flex items-center gap-4 p-4 transition-colors hover:bg-blush/30">
      {showThumb ? (
        item.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
          <img src={cloudinaryImageUrl(item.thumb, 160)} alt="" className="size-14 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-blush text-text-muted">
            <ImageIcon className="size-5" aria-hidden="true" />
          </span>
        )
      ) : null}
      <div className="min-w-0 flex-1">
        {/* The link covers the whole row (after:inset-0), so a click anywhere opens the editor. */}
        <Link href={item.href} className="font-medium text-primary after:absolute after:inset-0 group-hover:underline">
          {item.title}
        </Link>
        {item.subtitle ? <p className="text-xs text-text-muted">{item.subtitle}</p> : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {item.warning ? <Badge variant="warning">{item.warning}</Badge> : null}
        {item.live ? <Badge variant="success">{item.liveLabel ?? "Published"}</Badge> : <Badge variant="secondary">Draft</Badge>}
        <span
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-primary group-hover:border-primary"
          aria-hidden="true"
        >
          <Pencil className="size-3.5" />
          Edit
        </span>
      </div>
    </li>
  );
}

/** List screen shared by venues, menus, décor themes and blog posts. */
export function SimpleCmsList({
  title,
  description,
  newHref,
  newLabel,
  icon,
  emptyText,
  items,
  showThumbs = false,
  pageHref,
}: {
  title: string;
  description: string;
  newHref: string;
  newLabel: string;
  icon: LucideIcon;
  emptyText: string;
  items: CmsListItem[];
  showThumbs?: boolean;
  /** The public page's own editor (header photo, intro), when it has one. */
  pageHref?: string | null;
}) {
  const action = (
    <div className="flex flex-wrap gap-2">
      {pageHref ? (
        <Button asChild variant="outline">
          <Link href={pageHref}>Page header and intro</Link>
        </Button>
      ) : null}
      <Button asChild>
        <Link href={newHref}>{newLabel}</Link>
      </Button>
    </div>
  );
  return (
    <>
      <PageHeader title={title} description={description} actions={action} />
      {items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
          {items.map((item) => (
            <CmsListRow key={item.id} item={item} showThumb={showThumbs} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={icon} title={emptyText} action={action} />
      )}
    </>
  );
}
