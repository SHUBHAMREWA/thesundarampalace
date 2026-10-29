"use client";

import { Download, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Opens a photo (customer photo, ID document…) in a modal on the same page
 * instead of a new tab. `children` is what is clicked, e.g. a thumbnail.
 */
export function ImageViewer({
  src,
  title,
  downloadHref,
  label,
  className,
  children,
}: {
  src: string;
  title: string;
  /** Optional download link shown under the photo. */
  downloadHref?: string;
  /** Accessible name of the trigger. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <Dialog onOpenChange={(open) => open || setLoaded(false)}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn("cursor-zoom-in", className)}
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] gap-3 p-4 sm:max-w-3xl">
        <DialogTitle className="pr-8 text-base">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          Full-size photo
        </DialogDescription>
        <div className="relative flex min-h-48 items-center justify-center">
          {loaded ? null : (
            <Loader2
              className="absolute size-6 animate-spin text-text-muted"
              aria-label="Loading photo"
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- private file through the audited route */}
          <img
            src={src}
            alt={title}
            onLoad={() => setLoaded(true)}
            className="mx-auto max-h-[75vh] w-auto rounded-md object-contain"
          />
        </div>
        {downloadHref ? (
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={downloadHref}>
                <Download aria-hidden="true" /> Download
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
