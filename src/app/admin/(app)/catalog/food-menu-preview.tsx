"use client";

import { Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** The saved menu in a popup, exactly as the PDF prints it. `version` refreshes it after a save. */
export function FoodMenuPreview({ version }: { version: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <Eye aria-hidden="true" /> Preview
        </Button>
      </DialogTrigger>
      <DialogContent className="h-[92vh] max-w-[calc(100%-2rem)] grid-rows-[auto_1fr] gap-3 p-4 sm:max-w-4xl">
        <DialogTitle className="text-base">
          Food menu preview (as it will download)
        </DialogTitle>
        <DialogDescription className="sr-only">
          Every page of the menu PDF
        </DialogDescription>
        <iframe
          src={`/api/food-menu/preview?v=${encodeURIComponent(version)}`}
          title="Food menu preview"
          className="size-full rounded-md border border-border bg-surface"
        />
      </DialogContent>
    </Dialog>
  );
}
