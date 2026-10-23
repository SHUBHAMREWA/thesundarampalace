"use client";

import { FileText, Loader2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { toast } from "sonner";

import { DeleteButton } from "@/components/cms/delete-button";
import { ActionForm, ActionFeedback, LocalizedField, SelectField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEDIA_GROUPS } from "@/lib/content/catalog";
import type { Localized } from "@/lib/i18n/localized";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import { deleteAssetAction, getUploadSignatureAction, registerUploadAction, updateAssetAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

const GROUP_OPTIONS = MEDIA_GROUPS.map((g) => ({ value: g, label: g.replace(/_/g, " ") }));
const ACCEPT = "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,application/pdf";
const MAX_MB = { image: 10, video: 50, application: 15 } as const;

/** Browser → Cloudinary signed upload, then the server verifies and records it. */
export function UploadForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const file = data.get("file");
    const group = String(data.get("group") ?? "other");
    setError(null);
    setFieldErrors({});
    if (!(file instanceof File) || !file.size) return setFieldErrors({ file: "Choose a file" });
    const kind = file.type.split("/")[0] as keyof typeof MAX_MB;
    const limit = MAX_MB[kind] ?? 10;
    if (file.size > limit * 1024 * 1024) return setFieldErrors({ file: `Files of this type can be up to ${limit} MB` });
    if (!String(data.get("alt.en") ?? "").trim()) return setFieldErrors({ "alt.en": "Describe the image for people who can't see it" });

    setBusy(true);
    try {
      const signed = await getUploadSignatureAction(group);
      const upload = new FormData();
      upload.set("file", file);
      upload.set("api_key", signed.apiKey);
      upload.set("timestamp", String(signed.timestamp));
      upload.set("folder", signed.folder);
      upload.set("allowed_formats", signed.allowed_formats);
      upload.set("signature", signed.signature);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/auto/upload`, { method: "POST", body: upload });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? "Upload failed");
      const saved = await registerUploadAction({
        upload: result,
        group,
        alt: { en: data.get("alt.en"), hi: data.get("alt.hi") },
        caption: { en: data.get("caption.en") ?? "", hi: data.get("caption.hi") ?? "" },
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
          <Input id="upload-file" name="file" type="file" accept={ACCEPT} className="bg-surface" aria-invalid={!!fieldErrors.file} />
          <p className="text-xs text-text-muted">JPEG, PNG, WebP, AVIF up to 10 MB · MP4/WebM up to 50 MB · PDF up to 15 MB.</p>
          {fieldErrors.file ? <p className="text-sm text-danger">{fieldErrors.file}</p> : null}
        </div>
        <SelectField name="group" label="Used for" options={GROUP_OPTIONS} defaultValue="gallery" />
      </div>
      <LocalizedField name="alt" label="Alt text (describe the image)" required errors={fieldErrors} />
      <LocalizedField name="caption" label="Caption (optional)" errors={fieldErrors} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField name="photographerCredit" label="Photographer credit (optional)" />
        <TextField name="usagePermission" label="Usage permission (for wedding photos)" placeholder="e.g. Written consent from couple, 12 Oct 2026" />
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

export function AssetCard({ asset }: { asset: AssetView }) {
  const [state, action] = useActionState(updateAssetAction.bind(null, asset.id), idleState);
  const [open, setOpen] = useState(false);
  const e = state.fieldErrors ?? {};
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      {asset.resourceType === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
        <img src={cloudinaryImageUrl(asset.publicId, 480)} alt={asset.alt.en} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center bg-lavender">
          {asset.resourceType === "video" ? <Video className="size-8" aria-hidden="true" /> : <FileText className="size-8" aria-hidden="true" />}
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
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(!open)} aria-expanded={open}>
            {open ? "Close" : "Edit details"}
          </Button>
          <DeleteButton
            action={deleteAssetAction.bind(null, asset.id)}
            title="Delete this file?"
            description="Files still used on the website can't be deleted. Remove them from pages first."
          />
        </div>
        {open ? (
          <ActionForm action={action} className="space-y-3 border-t border-border pt-3">
            <ActionFeedback state={state} />
            <LocalizedField name="alt" label="Alt text" required defaultValue={asset.alt} errors={e} />
            <LocalizedField name="caption" label="Caption" defaultValue={asset.caption} errors={e} />
            <TextField name="photographerCredit" label="Photographer credit" defaultValue={asset.photographerCredit} />
            <TextField name="usagePermission" label="Usage permission" defaultValue={asset.usagePermission} />
            <SelectField name="group" label="Used for" options={GROUP_OPTIONS} defaultValue={asset.group} />
            <SubmitButton size="sm">Save</SubmitButton>
          </ActionForm>
        ) : null}
      </div>
    </div>
  );
}
