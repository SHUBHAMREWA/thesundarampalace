"use client";

import { Camera, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useFieldError } from "@/components/forms/form-kit";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { compressToWebp } from "@/lib/media/to-webp";

/**
 * Customer photo picker. The chosen photo is compressed to WebP in the
 * browser and put into the hidden `photo` file input that the form submits.
 */
export function PhotoInput({ currentUrl }: { currentUrl?: string | null }) {
  const uid = useId();
  const pickerId = `f${uid}photo`;
  const hiddenRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const serverError = useFieldError("photo");

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function choose(file: File | undefined) {
    setProblem(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProblem("Choose a photo (JPEG, PNG or WebP).");
      return;
    }
    setBusy(true);
    try {
      const webp = await compressToWebp(file, "avatar");
      const transfer = new DataTransfer();
      transfer.items.add(webp);
      hiddenRef.current!.files = transfer.files;
      setPreview(URL.createObjectURL(webp));
      setRemoved(false);
    } catch {
      setProblem("This photo could not be read. Try another one.");
    } finally {
      setBusy(false);
      if (pickerRef.current) pickerRef.current.value = "";
    }
  }

  function clear() {
    if (hiddenRef.current) hiddenRef.current.value = "";
    setPreview(null);
    setRemoved(Boolean(currentUrl));
  }

  const shown = preview ?? (removed ? null : currentUrl);
  const error = problem ?? serverError;
  return (
    <div className="space-y-1.5 md:col-span-2">
      <Label htmlFor={pickerId}>Photo (optional)</Label>
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Cloudinary URL or a local preview
            <img
              src={shown}
              alt="Customer photo"
              className="size-full object-cover"
            />
          ) : (
            <Camera className="size-6 text-text-muted" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => pickerRef.current?.click()}
          >
            {busy ? "Preparing…" : shown ? "Change photo" : "Add photo"}
          </Button>
          {shown ? (
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              <X aria-hidden="true" /> Remove
            </Button>
          ) : null}
        </div>
      </div>
      <input
        ref={pickerRef}
        id={pickerId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => choose(e.target.files?.[0])}
      />
      <input
        ref={hiddenRef}
        type="file"
        name="photo"
        accept="image/webp"
        hidden
      />
      {removed ? <input type="hidden" name="removePhoto" value="true" /> : null}
      <p className="text-xs text-text-muted">
        Compressed to WebP before upload. Changing or removing it deletes the
        old photo.
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
