"use client";

import { FileText, ImageIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Label } from "@/components/ui/label";
import { compressToWebp, isCompressibleImage, type WebpPreset } from "@/lib/media/to-webp";

import { useFieldError } from "./form-kit";

const size = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);

/**
 * File field that compresses photos to WebP in the browser before the form is
 * sent (PDFs pass through). The compressed file goes into a hidden input with
 * the field's `name`, so server actions receive it like any file upload.
 */
export function CompressedFileField({
  name,
  label,
  preset,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  required,
}: {
  name: string;
  label: string;
  preset: WebpPreset;
  accept?: string;
  required?: boolean;
}) {
  const id = `f${useId()}${name}`;
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<{ name: string; before: number; after: number; preview: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const serverError = useFieldError(name);

  useEffect(() => () => {
    if (picked?.preview) URL.revokeObjectURL(picked.preview);
  }, [picked]);

  // Clear the preview when the form resets after a successful upload.
  useEffect(() => {
    const form = hiddenRef.current?.form;
    const onReset = () => setPicked(null);
    form?.addEventListener("reset", onReset);
    return () => form?.removeEventListener("reset", onReset);
  }, []);

  async function choose(input: HTMLInputElement) {
    const file = input.files?.[0];
    setProblem(null);
    if (!file) return;
    setBusy(true);
    try {
      const ready = await compressToWebp(file, preset);
      const transfer = new DataTransfer();
      transfer.items.add(ready);
      hiddenRef.current!.files = transfer.files;
      setPicked({ name: ready.name, before: file.size, after: ready.size, preview: isCompressibleImage(ready) ? URL.createObjectURL(ready) : null });
    } catch {
      if (hiddenRef.current) hiddenRef.current.value = "";
      setPicked(null);
      setProblem("This photo could not be read. Try another one, or a PDF.");
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  const error = problem ?? serverError;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        type="file"
        accept={accept}
        required={required && !picked}
        onChange={(e) => choose(e.currentTarget)}
        aria-invalid={!!error}
        className="block w-full rounded-md border border-input bg-surface px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-blush file:px-2 file:py-1 file:text-primary"
      />
      <input ref={hiddenRef} type="file" name={name} hidden />
      {busy ? <p className="text-xs text-text-muted">Compressing…</p> : null}
      {picked ? (
        <div className="flex items-center gap-3 rounded-md border border-border bg-bg p-2 text-xs">
          <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface">
            {picked.preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen file
              <img src={picked.preview} alt="" className="size-full object-cover" />
            ) : (
              <FileText className="size-5 text-primary" aria-hidden="true" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{picked.name}</span>
            <span className="flex items-center gap-1 text-text-muted">
              {picked.preview ? <ImageIcon className="size-3.5" aria-hidden="true" /> : null}
              {picked.after < picked.before ? `WebP, ${size(picked.before)} → ${size(picked.after)}` : size(picked.after)}
            </span>
          </span>
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
