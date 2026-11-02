"use client";

import { Download, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

/**
 * Opens the print dialog for the bride and groom sheet (bride left, groom
 * right, with their documents); choose "Save as PDF" to download it. The sheet
 * runs no scripts of its own, so it is loaded in a hidden frame and printed
 * from here (same origin), like the payment history.
 */
export function BrideGroomPrint({ bookingId, withDocuments }: { bookingId: string; withDocuments: boolean }) {
  const [pending, start] = useTransition();
  const onClick = () =>
    start(
      () =>
        new Promise<void>((resolve) => {
          const frame = document.createElement("iframe");
          frame.style.position = "fixed";
          frame.style.width = "0";
          frame.style.height = "0";
          frame.style.border = "0";
          frame.src = `/api/bookings/${bookingId}/bride-groom`;
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

  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={pending}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
      Download PDF{withDocuments ? " with documents" : ""}
    </Button>
  );
}
