"use client";

import { Download, FileUp, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { ImageViewer } from "@/components/crm/image-viewer";
import { Button } from "@/components/ui/button";
import { formatIST } from "@/lib/time";
import {
  readyMenuUploadSignatureAction,
  removeReadyMenuPdfAction,
  saveReadyMenuPdfAction,
} from "@/server/actions/catalog";

export type ReadyMenu = {
  pages: number;
  bytes: number;
  fileName: string;
  uploadedAt: string;
};

const MAX_MB = 10;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * The ready-made menu PDF: upload it (straight to Cloudinary, kept private),
 * see its pages, download it as it is, or replace / remove it.
 */
export function ReadyMenuPanel({
  ready,
  fileUrl,
}: {
  ready: ReadyMenu | null;
  fileUrl: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();

  async function upload(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))
      return toast.error("Choose a PDF file.");
    if (file.size > MAX_MB * 1024 * 1024)
      return toast.error(`The PDF can be up to ${MAX_MB} MB (this one is ${mb(file.size)}).`);
    setBusy("Uploading…");
    try {
      const signed = await readyMenuUploadSignatureAction();
      const form = new FormData();
      form.set("file", file);
      form.set("api_key", signed.apiKey);
      for (const [key, value] of Object.entries(signed.params)) form.set(key, value);
      form.set("signature", signed.signature);
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
        { method: "POST", body: form },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error?.message ?? "Upload failed");
      setBusy("Saving…");
      const saved = await saveReadyMenuPdfAction(result);
      if (!saved.ok) throw new Error(saved.message ?? "Couldn't save the PDF.");
      toast.success(saved.message ?? "Uploaded.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  const remove = () => {
    if (!window.confirm("Remove the ready-made PDF? It is deleted from Cloudinary.")) return;
    startRemove(async () => {
      const result = await removeReadyMenuPdfAction();
      if (result.ok) {
        toast.success(result.message ?? "Removed.");
        router.refresh();
      } else toast.error(result.message ?? "Couldn't remove it.");
    });
  };

  return (
    <div className="space-y-4">
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
        <div>
          <p className="font-medium">
            {ready ? "The menu PDF as you supplied it" : "No ready-made PDF yet"}
          </p>
          <p className="mt-1 text-sm text-text-muted">
            {ready
              ? `${ready.fileName} · ${ready.pages} page${ready.pages === 1 ? "" : "s"} · ${mb(ready.bytes)} · uploaded ${formatIST(new Date(ready.uploadedAt), "d MMM yyyy")}. Sent as it is; to change the wording, edit the menu on its pages instead.`
              : `Upload the caterer's menu PDF (up to ${MAX_MB} MB) to send it as it is. It is kept privately on Cloudinary, not in the project.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ready ? (
            <Button asChild>
              <a href={fileUrl}>
                <Download aria-hidden="true" /> Download ready-made PDF
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant={ready ? "outline" : "default"}
            onClick={() => input.current?.click()}
            disabled={!!busy}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
            {busy ?? (ready ? "Replace PDF" : "Upload PDF")}
          </Button>
          {ready ? (
            <Button type="button" variant="ghost" onClick={remove} disabled={removing || !!busy}>
              <Trash2 aria-hidden="true" /> Remove
            </Button>
          ) : null}
        </div>
      </div>
      {ready ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from(
            { length: ready.pages },
            (_, i) => `${fileUrl}?page=${i + 1}&v=${encodeURIComponent(ready.uploadedAt)}`,
          ).map((src, i) => (
            <li key={src}>
              <ImageViewer
                src={src}
                title={`Page ${i + 1} of ${ready.pages}`}
                label={`Open page ${i + 1}`}
                className="block w-full overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-card)] hover:border-primary"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- staff-only page preview */}
                <img
                  src={src}
                  alt={`Ready-made menu, page ${i + 1}`}
                  loading="lazy"
                  className="aspect-[1/1.414] w-full object-cover"
                />
              </ImageViewer>
              <p className="mt-1 text-center text-xs text-text-muted">Page {i + 1}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
