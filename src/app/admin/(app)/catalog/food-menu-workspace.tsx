"use client";

import { Download, FileText, Loader2, MousePointerClick } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ImageViewer } from "@/components/crm/image-viewer";
import { Button } from "@/components/ui/button";
import { cleanMenu, type FoodMenu } from "@/lib/menu/food-menu";
import { cn } from "@/lib/utils";
import { saveFoodMenuAction } from "@/server/actions/catalog";

import { FoodMenuCanvas, type MenuImages } from "./food-menu-canvas";

const TABS = [
  { key: "page", label: "Edit on the page", icon: MousePointerClick },
  { key: "original", label: "Ready-made PDF", icon: FileText },
] as const;

/**
 * The menu, edited right on its pages (like a design tool), or the ready-made
 * PDF as supplied. Templates are listed above the pages; more can be added
 * as further designs for the same menu data.
 */
export function FoodMenuWorkspace({
  initial,
  images,
  originalUrl,
}: {
  initial: FoodMenu;
  images: MenuImages;
  originalUrl: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("page");
  const [menu, setMenu] = useState(initial);
  const [saving, start] = useTransition();

  const save = () =>
    start(async () => {
      const result = await saveFoodMenuAction(cleanMenu(menu));
      if (result.ok) {
        toast.success(result.message ?? "Saved.");
        router.refresh();
      } else toast.error(result.message ?? "Couldn't save the menu.");
    });

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Food menu"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface hover:border-primary",
            )}
          >
            <t.icon className="size-4" aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "page" ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Template</span>
            <button
              type="button"
              aria-pressed="true"
              className="flex items-center gap-2 rounded-lg border-2 border-primary bg-surface p-1.5 pr-3 text-sm"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- template thumbnail (data URI) */}
              <img
                src={images.pageTop}
                alt=""
                className="h-10 w-8 rounded object-cover object-top"
              />
              Royal blue — your menu
            </button>
          </div>
          <p className="text-sm text-text-muted">
            Click any text on the pages and type. “+ item”, “+ row”, “+ note”
            and “Add a page” add more; clear an item to remove it; each page has
            Move and Remove at its top right.
          </p>
          <FoodMenuCanvas menu={menu} setMenu={setMenu} images={images} />
        </>
      ) : null}
      {tab === "original" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
            <div>
              <p className="font-medium">The menu PDF as you supplied it</p>
              <p className="mt-1 text-sm text-text-muted">
                Ready to send as it is (10 pages, about 8 MB). Its text is drawn
                as shapes, so it can&apos;t be edited; edit the template
                instead.
              </p>
            </div>
            <Button asChild>
              <a href={originalUrl}>
                <Download aria-hidden="true" /> Download ready-made PDF
              </a>
            </Button>
          </div>
          {/* Page previews (JPEGs of the PDF); click one to see it large. */}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from(
              { length: 10 },
              (_, i) => `${originalUrl}?page=${i + 1}`,
            ).map((src, i) => (
              <li key={src}>
                <ImageViewer
                  src={src}
                  title={`Page ${i + 1} of 10`}
                  label={`Open page ${i + 1}`}
                  className="block w-full overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-card)] hover:border-primary"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- staff-only page preview */}
                  <img
                    src={src}
                    alt={`Ready-made menu, page ${i + 1}`}
                    loading="lazy"
                    className="aspect-[1/1.414] w-full object-cover"
                  />
                </ImageViewer>
                <p className="mt-1 text-center text-xs text-text-muted">
                  Page {i + 1}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab !== "original" ? (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-bg py-3">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}{" "}
            Save menu
          </Button>
          <p className="text-sm text-text-muted">
            Save first, then Preview or Download PDF shows the changes.
          </p>
        </div>
      ) : null}
    </div>
  );
}
