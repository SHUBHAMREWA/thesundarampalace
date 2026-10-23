"use client";

import { FileText, ImageIcon, Video } from "lucide-react";
import { useId, useState } from "react";

import { Field, nativeSelectClass } from "@/components/forms/form-kit";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { cn } from "@/lib/utils";

export type MediaOption = { id: string; label: string; publicId: string; resourceType: string; group: string };

function Thumb({ option, className }: { option: MediaOption | undefined; className?: string }) {
  if (!option) {
    return (
      <div className={cn("flex items-center justify-center rounded-md bg-blush text-text-muted", className)}>
        <ImageIcon className="size-5" aria-hidden="true" />
      </div>
    );
  }
  if (option.resourceType !== "image") {
    const Icon = option.resourceType === "video" ? Video : FileText;
    return (
      <div className={cn("flex items-center justify-center rounded-md bg-lavender", className)}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
    <img src={cloudinaryImageUrl(option.publicId, 160)} alt="" className={cn("rounded-md object-cover", className)} />
  );
}

/** Single image chooser backed by the media library. */
export function MediaPicker({
  name,
  label,
  options,
  defaultValue,
  hint,
  error,
}: {
  name: string;
  label: string;
  options: MediaOption[];
  defaultValue?: string | null;
  hint?: string;
  error?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const id = `f${useId()}${name}`;
  return (
    <Field label={label} htmlFor={id} hint={hint ?? (options.length ? undefined : "Upload files in the Media library first.")} error={error}>
      <div className="flex items-center gap-3">
        <Thumb option={options.find((o) => o.id === value)} className="size-14 shrink-0" />
        <select id={id} name={name} value={value} onChange={(e) => setValue(e.target.value)} className={nativeSelectClass}>
          <option value="">None — show a placeholder</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} ({o.group})
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
}

/** Ordered multi-select; the tick order becomes the display order. */
export function MediaMultiPicker({
  name,
  label,
  options,
  defaultValue = [],
}: {
  name: string;
  label: string;
  options: MediaOption[];
  defaultValue?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {options.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {options.map((o) => {
            const position = selected.indexOf(o.id);
            return (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => toggle(o.id)}
                  aria-pressed={position >= 0}
                  aria-label={`${position >= 0 ? "Remove" : "Add"} ${o.label}`}
                  className={cn(
                    "relative block w-full overflow-hidden rounded-md border-2",
                    position >= 0 ? "border-primary" : "border-transparent",
                  )}
                >
                  <Thumb option={o} className="aspect-square w-full" />
                  {position >= 0 ? (
                    <span className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                      {position + 1}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">No images yet. Upload them in the Media library.</p>
      )}
    </fieldset>
  );
}
