"use client";

import { FileText, Loader2, RefreshCw, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  sendToCloudinary,
  sizeError,
} from "@/components/cms/cloudinary-upload";
import { DeleteButton } from "@/components/cms/delete-button";
import { DevicePreview } from "@/components/cms/device-preview";
import {
  ActionForm,
  ActionFeedback,
  LocalizedField,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/forms/form-kit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEDIA_GROUPS } from "@/lib/content/catalog";
import type { Localized } from "@/lib/i18n/localized";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import {
  deleteAssetAction,
  registerUploadAction,
  replaceAssetAction,
  updateAssetAction,
} from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

const GROUP_OPTIONS = MEDIA_GROUPS.map((g) => ({
  value: g,
  label: g.replace(/_/g, " "),
}));
const ACCEPT =
  "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime,.mov,application/pdf";
/** Local preview URL for a chosen image file (revoked when it changes). */
function useLocalPreview(file: File | null): string | null {
  const url = useMemo(
    () =>
      file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    [file],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  return url;
}

/** Browser → (WebP compression for photos) → Cloudinary signed upload, then the server verifies and records it. */
export function UploadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [chosen, setChosen] = useState<File | null>(null);
  const preview = useLocalPreview(chosen);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const group = String(data.get("group") ?? "other");
    setError(null);
    setFieldErrors({});
    if (!(file instanceof File) || !file.size)
      return setFieldErrors({ file: "Choose a file" });
    const tooBig = sizeError(file);
    if (tooBig) return setFieldErrors({ file: tooBig });
    if (!String(data.get("alt.en") ?? "").trim())
      return setFieldErrors({
        "alt.en": "Describe the image for people who can't see it",
      });

    setBusy(true);
    try {
      const result = await sendToCloudinary(file, group);
      const saved = await registerUploadAction({
        upload: result,
        group,
        alt: { en: data.get("alt.en"), hi: data.get("alt.hi") },
        caption: {
          en: data.get("caption.en") ?? "",
          hi: data.get("caption.hi") ?? "",
        },
        photographerCredit: data.get("photographerCredit"),
        usagePermission: data.get("usagePermission"),
      });
      if (!saved.ok) {
        setError(saved.message ?? "Upload could not be saved");
        setFieldErrors(saved.fieldErrors ?? {});
        return;
      }
      toast.success("Uploaded");
      form.reset();
      setChosen(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="upload-file">File</Label>
          <Input
            id="upload-file"
            name="file"
            type="file"
            accept={ACCEPT}
            className="bg-surface"
            aria-invalid={!!fieldErrors.file}
            onChange={(e) => setChosen(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-text-muted">
            JPEG, PNG, WebP, AVIF up to 10 MB (photos are converted to WebP
            before upload) · MP4/WebM up to 50 MB (hero film: 1920×1080, 15–30
            s) · PDF up to 15 MB. Everything is stored in Cloudinary; deleting
            or replacing a file here also deletes it there.
          </p>
          {fieldErrors.file ? (
            <p className="text-sm text-danger">{fieldErrors.file}</p>
          ) : null}
        </div>
        <SelectField
          name="group"
          label="Used for"
          options={GROUP_OPTIONS}
          defaultValue="gallery"
        />
      </div>
      <DevicePreview src={preview} />
      <LocalizedField
        name="alt"
        label="Alt text (describe the image)"
        required
        errors={fieldErrors}
      />
      <LocalizedField
        name="caption"
        label="Caption (optional)"
        errors={fieldErrors}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          name="photographerCredit"
          label="Photographer credit (optional)"
        />
        <TextField
          name="usagePermission"
          label="Usage permission (for wedding photos)"
          placeholder="e.g. Written consent from couple, 12 Oct 2026"
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Upload
      </Button>
    </form>
  );
}

type AssetView = {
  id: string;
  publicId: string;
  resourceType: string;
  group: string;
  alt: Localized;
  caption: Localized | null;
  photographerCredit: string;
  usagePermission: string;
  size: string | null;
};

/** Choose a new file, check it on desktop and mobile, then swap it in. */
function ReplaceFile({ asset }: { asset: AssetView }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useLocalPreview(file);
  const accept =
    asset.resourceType === "image"
      ? "image/jpeg,image/png,image/webp,image/avif"
      : asset.resourceType === "video"
        ? "video/mp4,video/webm,video/quicktime,.mov"
        : "application/pdf";

  async function replace() {
    if (!file) return;
    const tooBig = sizeError(file);
    if (tooBig) return setError(tooBig);
    setBusy(true);
    setError(null);
    try {
      const result = await sendToCloudinary(file, asset.group);
      const saved = await replaceAssetAction(asset.id, { upload: result });
      if (!saved.ok)
        return setError(
          saved.fieldErrors?.file ??
            saved.message ??
            "The file could not be replaced",
        );
      toast.success(saved.message ?? "File replaced");
      setFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label="New file"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setError(null);
        }}
      />
      {file ? (
        <>
          <p className="text-sm">
            New file: <span className="font-medium">{file.name}</span>
          </p>
          <DevicePreview src={preview} />
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <p className="text-xs text-text-muted">
            Every page using this file will show the new one. The old file is
            deleted from Cloudinary.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={replace} disabled={busy}>
              {busy ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : null}
              Replace file
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setFile(null);
                if (input.current) input.current.value = "";
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => input.current?.click()}
        >
          <RefreshCw aria-hidden="true" />
          Choose new file
        </Button>
      )}
    </div>
  );
}

export function AssetCard({ asset }: { asset: AssetView }) {
  const [state, action] = useActionState(
    updateAssetAction.bind(null, asset.id),
    idleState,
  );
  const [open, setOpen] = useState(false);
  const e = state.fieldErrors ?? {};
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {asset.resourceType === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
        <img
          src={cloudinaryImageUrl(asset.publicId, 480)}
          alt={asset.alt.en}
          className="aspect-[4/3] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-lavender">
          {asset.resourceType === "video" ? (
            <Video className="size-8" aria-hidden="true" />
          ) : (
            <FileText className="size-8" aria-hidden="true" />
          )}
        </div>
      )}
      <div className="space-y-2 p-3">
        <p className="text-sm font-medium">{asset.alt.en}</p>
        <p className="text-xs text-text-muted">
          {asset.group.replace(/_/g, " ")}
          {asset.size ? ` · ${asset.size}` : ""}
          {asset.photographerCredit ? ` · © ${asset.photographerCredit}` : ""}
        </p>
        <div className="flex justify-between">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
          >
            {open ? "Close" : "Edit details"}
          </Button>
          <DeleteButton
            action={deleteAssetAction.bind(null, asset.id)}
            title="Delete this file?"
            description="Files still used on the website can't be deleted. Remove them from pages first."
          />
        </div>
        {open ? (
          <ActionForm
            action={action}
            className="space-y-3 border-t border-border pt-3"
          >
            <ActionFeedback state={state} />
            <LocalizedField
              name="alt"
              label="Alt text"
              required
              defaultValue={asset.alt}
              errors={e}
            />
            <LocalizedField
              name="caption"
              label="Caption"
              defaultValue={asset.caption}
              errors={e}
            />
            <TextField
              name="photographerCredit"
              label="Photographer credit"
              defaultValue={asset.photographerCredit}
            />
            <TextField
              name="usagePermission"
              label="Usage permission"
              defaultValue={asset.usagePermission}
            />
            <SelectField
              name="group"
              label="Used for"
              options={GROUP_OPTIONS}
              defaultValue={asset.group}
            />
            <SubmitButton size="sm">Save</SubmitButton>
          </ActionForm>
        ) : null}
        {open ? <ReplaceFile asset={asset} /> : null}
      </div>
    </div>
  );
}
