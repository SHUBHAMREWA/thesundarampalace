"use client";

import { Download, Eye, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  bookingFoodMenuPdfUrl,
  cleanMenu,
  type FoodMenu,
} from "@/lib/menu/food-menu";
import {
  resetBookingFoodMenuAction,
  saveBookingFoodMenuAction,
} from "@/server/actions/catalog";

import { FoodMenuCanvas, type MenuImages } from "../../catalog/food-menu-canvas";

/**
 * This booking's own menu: a copy of the venue menu, edited on its pages like
 * the Food menu screen. Each item is marked blue (picked: prints for this
 * customer) or red (left out); the preview and PDF show only the blue ones.
 */
export function BookingFoodMenu({
  bookingId,
  initial,
  saved,
  images,
  canEdit,
}: {
  bookingId: string;
  initial: FoodMenu;
  /** False until the booking's menu is first saved. */
  saved: boolean;
  images: MenuImages;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [menu, setMenu] = useState(initial);
  const [saving, startSave] = useTransition();
  const [resetting, startReset] = useTransition();
  const [opening, startOpen] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);

  const picked = menu.sections.reduce(
    (n, s) =>
      n + s.groups.reduce((m, g) => m + (g.picked?.filter(Boolean).length ?? 0), 0),
    0,
  );

  /** Saves the menu as it is on screen; false when it couldn't be saved. */
  async function store(announce: boolean): Promise<boolean> {
    if (!canEdit) return true;
    const result = await saveBookingFoodMenuAction(bookingId, cleanMenu(menu));
    if (!result.ok) {
      toast.error(result.message ?? "Couldn't save the menu.");
      return false;
    }
    if (announce) toast.success(result.message ?? "Saved.");
    return true;
  }

  const save = () =>
    startSave(async () => {
      if (await store(true)) router.refresh();
    });

  // Preview and Download save first, so they always show exactly the blue items on screen.
  const openPreview = () =>
    startOpen(async () => {
      if (await store(false))
        setPreview(
          `/api/food-menu/preview?booking=${encodeURIComponent(bookingId)}&t=${Date.now()}`,
        );
    });
  const download = () =>
    startOpen(async () => {
      if (!(await store(false))) return;
      const link = document.createElement("a");
      link.href = bookingFoodMenuPdfUrl(bookingId);
      link.click();
    });

  const reset = () => {
    if (
      !window.confirm(
        "Start this booking's menu again from the venue menu? Its edits and picks are cleared.",
      )
    )
      return;
    startReset(async () => {
      const result = await resetBookingFoodMenuAction(bookingId);
      if (result.ok) {
        toast.success(result.message ?? "Done.");
        router.refresh();
      } else toast.error(result.message ?? "Couldn't reset the menu.");
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="space-y-1 text-sm">
          <p className="font-medium">
            {picked} item{picked === 1 ? "" : "s"} picked for this booking
          </p>
          <p className="text-text-muted">
            <span className="font-semibold text-info">Blue ✓</span> prints for
            this customer, <span className="font-semibold text-danger">red ✕</span>{" "}
            is left out. Click the mark to switch it; click any text to change it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={openPreview}
            disabled={opening || picked === 0}
          >
            {opening ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}{" "}
            Preview
          </Button>
          <Button
            type="button"
            onClick={download}
            disabled={opening || picked === 0}
          >
            <Download aria-hidden="true" /> Download PDF
          </Button>
          {canEdit && saved ? (
            <Button
              type="button"
              variant="ghost"
              onClick={reset}
              disabled={resetting}
            >
              <RotateCcw aria-hidden="true" /> Start again
            </Button>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={menu.showRateList !== false}
            onChange={(e) =>
              setMenu((m) => ({ ...m, showRateList: e.target.checked }))
            }
          />
          Include the rate-list page in this booking&apos;s menu
        </label>
      ) : null}

      <div className={canEdit ? undefined : "pointer-events-none"}>
        <FoodMenuCanvas
          menu={menu}
          setMenu={setMenu}
          images={images}
          pickable
        />
      </div>

      {canEdit ? (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-bg py-3">
          <Button type="button" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}{" "}
            Save menu for this booking
          </Button>
          <p className="text-sm text-text-muted">
            Preview and Download save it too, and show only the blue items.
          </p>
        </div>
      ) : null}

      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="h-[92vh] max-w-[calc(100%-2rem)] grid-rows-[auto_1fr] gap-3 p-4 sm:max-w-4xl">
          <DialogTitle className="text-base">
            Food menu for this booking (only the blue items)
          </DialogTitle>
          <DialogDescription className="sr-only">
            The pages as they will download
          </DialogDescription>
          {preview ? (
            <iframe
              src={preview}
              title="Food menu preview"
              className="size-full rounded-md border border-border bg-surface"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
