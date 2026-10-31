"use client";

import { Download, Loader2, Printer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { generateDocumentAction } from "@/server/actions/documents";

/**
 * Print or download the booking's payment history (the Payment Statement:
 * every payment with its date, total received and balance) from the
 * Payments tab, without going to Documents.
 */
export function PaymentHistoryActions({
  bookingId,
  fields,
}: {
  bookingId: string;
  fields: string[];
}) {
  const router = useRouter();
  const [downloading, startDownload] = useTransition();
  const [printing, startPrint] = useTransition();
  const params = new URLSearchParams({
    bookingId,
    type: "payment_statement",
    template: "minimal",
  });
  for (const f of fields) params.append("f", f);
  const previewUrl = `/api/documents/preview?${params.toString()}`;

  // The preview page runs no scripts of its own, so it is loaded in a hidden
  // frame and printed from here (same origin).
  const onPrint = () =>
    startPrint(
      () =>
        new Promise<void>((resolve) => {
          const frame = document.createElement("iframe");
          frame.style.position = "fixed";
          frame.style.width = "0";
          frame.style.height = "0";
          frame.style.border = "0";
          frame.src = previewUrl;
          frame.onload = () => {
            try {
              frame.contentWindow?.focus();
              frame.contentWindow?.print();
            } catch {
              toast.error("Couldn't open the print dialog.");
            }
            setTimeout(() => frame.remove(), 60_000);
            resolve();
          };
          document.body.appendChild(frame);
        }),
    );

  const onDownload = () =>
    startDownload(async () => {
      const result = await generateDocumentAction({
        bookingId,
        type: "payment_statement",
        template: "minimal",
        fields,
        sourceId: null,
        customNote: null,
      });
      if (!result.ok) {
        toast.error(result.message ?? "Couldn't make the PDF.");
        return;
      }
      router.refresh();
      const link = document.createElement("a");
      link.href = `/api/documents/${(result.data as { id: string }).id}`;
      link.click();
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onPrint} disabled={printing}>
        {printing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Printer aria-hidden="true" />}
        Print
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onDownload} disabled={downloading}>
        {downloading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
        Download PDF
      </Button>
    </div>
  );
}
