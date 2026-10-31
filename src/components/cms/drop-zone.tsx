"use client";

import { useState, type DragEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Lets files be dragged from the computer and dropped onto an upload area.
 * Only files matching `accept` (MIME types or extensions, like an <input
 * accept>) are passed on; with `multiple` false, only the first one.
 */
export function DropZone({
  accept,
  multiple,
  disabled,
  onFiles,
  onRejected,
  children,
  className,
}: {
  accept: string;
  multiple: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  /** Called when the dropped files are all of the wrong type. */
  onRejected?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [over, setOver] = useState(false);
  const rules = accept.split(",").map((r) => r.trim().toLowerCase()).filter(Boolean);
  const accepted = (file: File) =>
    rules.some((rule) =>
      rule.startsWith(".")
        ? file.name.toLowerCase().endsWith(rule)
        : rule.endsWith("/*")
          ? file.type.startsWith(rule.slice(0, -1))
          : file.type === rule,
    );

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      onDragOver={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        if (disabled || !hasFiles(e)) return;
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files).filter(accepted);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
        else onRejected?.();
      }}
      className={cn(
        "rounded-lg border-2 border-dashed border-border p-3 transition-colors",
        over && "border-primary bg-blush/40",
        disabled && "opacity-70",
        className,
      )}
    >
      {children}
    </div>
  );
}
