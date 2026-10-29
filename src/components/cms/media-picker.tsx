"use client";

import {
  FileText,
  ImageIcon,
  Loader2,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Field, nativeSelectClass } from "@/components/forms/form-kit";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { MEDIA_GROUPS } from "@/lib/content/catalog";
import { cloudinaryImageUrl, cloudinaryVideoUrl } from "@/lib/media/cloudinary";
import { cn } from "@/lib/utils";
import {
  deletePickerAssetAction,
  uploadToLibraryAction,
} from "@/server/actions/cms";

import { sendToCloudinary, sizeError } from "./cloudinary-upload";
import { DevicePreview, type PreviewLayout } from "./device-preview";

export type MediaOption = {
  id: string;
  label: string;
  publicId: string;
  resourceType: string;
  group: string;
};

/**
 * Lets a picker upload straight to Cloudinary (and the media library) without
 * leaving the form. `enabled` is false until Cloudinary keys are set.
 */
export type PickerUpload = {
  enabled: boolean;
  group: (typeof MEDIA_GROUPS)[number];
  kind: "image" | "video";
  alt: string;
};

const ACCEPT = {
  image: "image/jpeg,image/png,image/webp,image/avif",
  video: "video/mp4,video/webm,video/quicktime,.mov",
} as const;

function Thumb({
  option,
  className,
}: {
  option: MediaOption | undefined;
  className?: string;
}) {
  if (!option) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-blush text-text-muted",
          className,
        )}
      >
        <ImageIcon className="size-5" aria-hidden="true" />
      </div>
    );
  }
  if (option.resourceType !== "image") {
    const Icon = option.resourceType === "video" ? Video : FileText;
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-lavender",
          className,
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail
    <img
      src={cloudinaryImageUrl(option.publicId, 160)}
      alt=""
      className={cn("rounded-md object-cover", className)}
    />
  );
}

/**
 * What a picker lists: files uploaded here first, then the library. After an
 * upload the page refreshes and the library already has them, so each id
 * appears once. A picker that uploads shows only its own group's files (plus
 * any already chosen), so photos from other sections don't appear in it.
 * With `own` (the given ids) it lists only those and files uploaded here, so a
 * new venue or décor theme starts empty instead of showing another one's photos.
 */
function visibleOptions(
  added: MediaOption[],
  options: MediaOption[],
  upload: PickerUpload | undefined,
  chosen: string[],
  deleted: string[],
  own?: string[],
): MediaOption[] {
  const byId = new Map<string, MediaOption>();
  for (const o of [...added, ...options])
    if (!byId.has(o.id)) byId.set(o.id, o);
  const addedIds = new Set(added.map((o) => o.id));
  return [...byId.values()].filter((o) => {
    if (deleted.includes(o.id)) return false;
    if (own)
      return own.includes(o.id) || addedIds.has(o.id) || chosen.includes(o.id);
    return !upload || o.group === upload.group || chosen.includes(o.id);
  });
}

/** Trash button: deletes the file from every page, the media library and Cloudinary, after a confirmation. */
function DeletePhotoButton({
  option,
  onDeleted,
  className,
}: {
  option: MediaOption;
  onDeleted: (id: string) => void;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const kind = option.resourceType === "video" ? "video" : "photo";
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label={`Delete ${option.label}`}
          title={`Delete this ${kind}`}
          className={className}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this {kind}?</AlertDialogTitle>
          <AlertDialogDescription>
            It is removed from every page that uses it, from the media library
            and from Cloudinary. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel type="button" disabled={pending}>
            Cancel
          </AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deletePickerAssetAction(option.id);
                if (!result.ok) return setError(result.message);
                setOpen(false);
                onDeleted(option.id);
                toast.success(result.message);
                router.refresh();
              })
            }
          >
            {pending ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : null}
            Delete {kind}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PreviewFor({
  option,
  layout,
  className,
}: {
  option: MediaOption | undefined;
  layout: PreviewLayout;
  className?: string;
}) {
  return option?.resourceType === "image" ? (
    <DevicePreview
      src={option.publicId}
      layout={layout}
      className={className}
    />
  ) : null;
}

/** "Upload from computer" button: photos become WebP, everything goes to Cloudinary, then into the picker. */
export function UploadButton({
  upload,
  multiple,
  onAdded,
}: {
  upload: PickerUpload;
  multiple: boolean;
  onAdded: (options: MediaOption[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!upload.enabled) {
    return (
      <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
        Uploading is off: Cloudinary is not connected yet. Add the Cloudinary
        keys to the server settings (.env), then reload.
      </p>
    );
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setDone(null);
    const added: MediaOption[] = [];
    try {
      for (const [i, file] of [...files].entries()) {
        const tooBig = sizeError(file);
        if (tooBig) throw new Error(`${file.name}: ${tooBig}`);
        setBusy(
          files.length > 1
            ? `Uploading ${i + 1} of ${files.length}…`
            : "Uploading…",
        );
        const result = await sendToCloudinary(file, upload.group);
        const saved = await uploadToLibraryAction({
          upload: result,
          group: upload.group,
          alt: { en: upload.alt },
          caption: { en: "", hi: "" },
        });
        if (!saved.ok) throw new Error(`${file.name}: ${saved.message}`);
        added.push(saved.option);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (added.length) {
        onAdded(added);
        setDone(
          `${added.length === 1 ? (upload.kind === "video" ? "Video" : "Photo") : `${added.length} photos`} uploaded and chosen. Press Save to show ${added.length === 1 ? "it" : "them"} on the website.`,
        );
      }
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={input}
        type="file"
        accept={ACCEPT[upload.kind]}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onFiles(e.target.files)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => input.current?.click()}
        disabled={!!busy}
      >
        {busy ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Upload aria-hidden="true" />
        )}
        {busy ??
          (upload.kind === "video"
            ? "Upload a video"
            : multiple
              ? "Upload photos"
              : "Upload a photo")}
      </Button>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="text-sm text-success" role="status">
          {done}
        </p>
      ) : null}
    </div>
  );
}

/** Single image (or video) chooser backed by the media library. */
export function MediaPicker({
  name,
  label,
  options,
  defaultValue,
  hint,
  error,
  preview = false,
  upload,
  ownOnly = false,
}: {
  name: string;
  label: string;
  options: MediaOption[];
  defaultValue?: string | null;
  hint?: string;
  error?: string;
  /** Show how the chosen image crops on desktop and mobile, in the given website layout. */
  preview?: PreviewLayout | false;
  upload?: PickerUpload;
  /** List only this item's own photo (and new uploads), not the rest of the library. */
  ownOnly?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [own] = useState(defaultValue ? [defaultValue] : []);
  const [added, setAdded] = useState<MediaOption[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  const all = visibleOptions(
    added,
    options,
    upload,
    value ? [value] : [],
    deleted,
    ownOnly ? own : undefined,
  );
  const id = `f${useId()}${name}`;
  const chosen = all.find((o) => o.id === value);
  return (
    <Field
      label={label}
      htmlFor={id}
      hint={
        hint ??
        (all.length || upload
          ? undefined
          : "Upload files in the Media library first.")
      }
      error={error}
    >
      <div className="flex items-center gap-3">
        <Thumb option={chosen} className="size-14 shrink-0" />
        <select
          id={id}
          name={name}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={nativeSelectClass}
        >
          <option value="">None — show a placeholder</option>
          {all.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} ({o.group})
            </option>
          ))}
        </select>
      </div>
      {upload ? (
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <UploadButton
            upload={upload}
            multiple={false}
            onAdded={(options) => {
              setAdded((a) => [...options, ...a]);
              setValue(options[0].id);
            }}
          />
          {chosen ? (
            <DeletePhotoButton
              option={chosen}
              onDeleted={(gone) => {
                setDeleted((d) => [...d, gone]);
                setValue("");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-danger hover:bg-danger/10 [&>svg]:size-4"
            />
          ) : null}
        </div>
      ) : null}
      {chosen?.resourceType === "video" ? (
        <video
          key={chosen.publicId}
          src={cloudinaryVideoUrl(chosen.publicId, 720)}
          className="mt-3 aspect-video w-full max-w-xl rounded-lg bg-primary-deep object-cover"
          controls
          muted
          playsInline
          preload="metadata"
        />
      ) : null}
      {preview ? (
        <PreviewFor option={chosen} layout={preview} className="mt-3" />
      ) : null}
    </Field>
  );
}

/** Ordered multi-select; the tick order becomes the display order. */
export function MediaMultiPicker({
  name,
  label,
  options,
  defaultValue = [],
  hint,
  error,
  preview = false,
  upload,
  ownOnly = false,
}: {
  name: string;
  label: string;
  options: MediaOption[];
  defaultValue?: string[];
  hint?: string;
  error?: string;
  /** Show how the last chosen image crops on desktop and mobile, in the given website layout. */
  preview?: PreviewLayout | false;
  upload?: PickerUpload;
  /** List only this item's own photos (and new uploads), not the rest of the library. */
  ownOnly?: boolean;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const [own] = useState(defaultValue);
  const [focus, setFocus] = useState<string | null>(null);
  const [added, setAdded] = useState<MediaOption[]>([]);
  const [deleted, setDeleted] = useState<string[]>([]);
  const all = visibleOptions(
    added,
    options,
    upload,
    selected,
    deleted,
    ownOnly ? own : undefined,
  );
  const toggle = (id: string) => {
    setSelected((s) =>
      s.includes(id) ? s.filter((v) => v !== id) : [...s, id],
    );
    setFocus(selected.includes(id) ? null : id);
  };
  const previewId = focus && selected.includes(focus) ? focus : selected[0];
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {hint ? <p className="text-sm text-text-muted">{hint}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {all.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {all.map((o) => {
            const position = selected.indexOf(o.id);
            return (
              <li key={o.id} className="relative">
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
                {upload ? (
                  <DeletePhotoButton
                    option={o}
                    onDeleted={(gone) => {
                      setDeleted((d) => [...d, gone]);
                      setSelected((s) => s.filter((v) => v !== gone));
                    }}
                    className="absolute top-1 left-1 flex size-6 items-center justify-center rounded-full bg-surface/90 text-danger shadow-card hover:bg-danger hover:text-primary-foreground"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">
          {upload
            ? "No photos yet. Upload them below."
            : "No images yet. Upload them in the Media library."}
        </p>
      )}
      {upload ? (
        <UploadButton
          upload={upload}
          multiple
          onAdded={(options) => {
            setAdded((a) => [...options, ...a]);
            setSelected((s) => [...s, ...options.map((o) => o.id)]);
            setFocus(options[0].id);
          }}
        />
      ) : null}
      {preview ? (
        <PreviewFor
          option={all.find((o) => o.id === previewId)}
          layout={preview}
        />
      ) : null}
    </fieldset>
  );
}
