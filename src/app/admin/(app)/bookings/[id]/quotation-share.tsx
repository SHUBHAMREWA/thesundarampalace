"use client";

import { Download, Eye, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { generateDocumentAction } from "@/server/actions/documents";

/**
 * Preview, download and send the booking's quotation without going to the
 * Documents tab. "Send on WhatsApp" makes the PDF and hands it to the phone's
 * share sheet; where a browser can't share files it downloads the PDF and
 * opens the customer's WhatsApp chat so it can be attached there.
 */
export function QuotationShare({
  bookingId,
  versionId,
  fields,
  whatsappHref,
  fileName,
}: {
  bookingId: string;
  versionId: string;
  fields: string[];
  /** wa.me link to the customer, with a short message; null without a number. */
  whatsappHref: string | null;
  fileName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"download" | "whatsapp" | null>(null);
  const params = new URLSearchParams({
    bookingId,
    type: "quotation",
    template: "elegant",
    sourceId: versionId,
  });
  for (const f of fields) params.append("f", f);
  const previewUrl = `/api/documents/preview?${params.toString()}`;

  /** Generates the PDF (kept in the Documents history) and returns its URL. */
  async function makePdf(): Promise<string | null> {
    const result = await generateDocumentAction({
      bookingId,
      type: "quotation",
      template: "elegant",
      fields,
      sourceId: versionId,
      customNote: null,
    });
    if (!result.ok) {
      toast.error(result.message ?? "Couldn't make the PDF.");
      return null;
    }
    router.refresh();
    return `/api/documents/${(result.data as { id: string }).id}`;
  }

  function download(url: string) {
    const link = document.createElement("a");
    link.href = url;
    link.click();
  }

  const onDownload = () =>
    start(async () => {
      setBusy("download");
      const url = await makePdf();
      if (url) download(url);
      setBusy(null);
    });

  const onWhatsApp = () =>
    start(async () => {
      setBusy("whatsapp");
      try {
        const url = await makePdf();
        if (!url) return;
        const blob = await fetch(url).then((r) => (r.ok ? r.blob() : null));
        const file = blob
          ? new File([blob], fileName, { type: blob.type || "application/pdf" })
          : null;
        if (file && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: fileName });
          return;
        }
        // No file sharing in this browser: save the PDF, then open the chat to attach it.
        download(url);
        if (whatsappHref)
          window.open(whatsappHref, "_blank", "noopener,noreferrer");
        toast.info(
          "PDF downloaded. Attach it in the WhatsApp chat that just opened.",
        );
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          toast.error("Couldn't share the PDF.");
      } finally {
        setBusy(null);
      }
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <Eye aria-hidden="true" /> Preview
          </Button>
        </DialogTrigger>
        <DialogContent className="h-[90vh] max-w-[calc(100%-2rem)] grid-rows-[auto_1fr] gap-3 p-4 sm:max-w-4xl">
          <DialogTitle className="text-base">
            Quotation preview (as it will download)
          </DialogTitle>
          <DialogDescription className="sr-only">
            The quotation PDF page
          </DialogDescription>
          <iframe
            src={previewUrl}
            title="Quotation preview"
            className="size-full rounded-md border border-border bg-surface"
          />
        </DialogContent>
      </Dialog>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onDownload}
        disabled={pending}
      >
        {busy === "download" ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}{" "}
        Download PDF
      </Button>
      {whatsappHref ? (
        <Button type="button" size="sm" onClick={onWhatsApp} disabled={pending}>
          {busy === "whatsapp" ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <WhatsAppIcon />
          )}{" "}
          Send on WhatsApp
        </Button>
      ) : null}
    </div>
  );
}
