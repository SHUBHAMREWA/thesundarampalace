import { Badge } from "@/components/ui/badge";

/** Lead status badge: CRM status colours, not brand pinks (design-system.md). */
export function LeadStatusBadge({ label, systemKey, statusKey }: { label: string; systemKey?: string | null; statusKey: string }) {
  const variant =
    systemKey === "WON"
      ? "success"
      : systemKey === "LOST"
        ? "danger"
        : systemKey === "NEW"
          ? "info"
          : statusKey.includes("follow") || statusKey.includes("negotiation")
            ? "warning"
            : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}

const BOOKING_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "secondary"> = {
  ENQUIRY_HOLD: "info",
  TENTATIVE: "warning",
  QUOTATION_SENT: "warning",
  CONFIRMED: "success",
  IN_PROGRESS: "success",
  COMPLETED: "secondary",
  CANCELLED: "danger",
};

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  ENQUIRY_HOLD: "Not booked yet",
  TENTATIVE: "Not booked yet",
  QUOTATION_SENT: "Not booked yet",
  CONFIRMED: "Booked",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Booking status; `label` comes from the configurable booking_status list when available. */
export function BookingStatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge variant={BOOKING_VARIANT[status] ?? "secondary"}>{label ?? BOOKING_STATUS_LABEL[status] ?? status}</Badge>;
}

const RESERVATION_LABEL: Record<string, string> = {
  HOLD: "Hold",
  TENTATIVE: "Not booked yet",
  CONFIRMED: "Booked",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
};

export function ReservationBadge({ state, waitlistPosition }: { state: string; waitlistPosition?: number | null }) {
  if (state === "HOLD" && waitlistPosition) return <Badge variant="outline">Waitlist #{waitlistPosition}</Badge>;
  const variant = state === "CONFIRMED" ? "success" : state === "HOLD" ? "info" : state === "TENTATIVE" ? "warning" : "secondary";
  return <Badge variant={variant}>{RESERVATION_LABEL[state] ?? state}</Badge>;
}

const MESSAGE_STATUS: Record<string, { label: string; variant: "success" | "warning" | "danger" | "info" | "secondary" | "outline" }> = {
  PENDING: { label: "Waiting", variant: "outline" },
  SENT: { label: "Sent", variant: "info" },
  DELIVERED: { label: "Delivered", variant: "success" },
  READ: { label: "Read", variant: "success" },
  FAILED: { label: "Failed", variant: "danger" },
  SKIPPED_NO_CONSENT: { label: "Skipped: no permission", variant: "secondary" },
  NOT_SENT_NO_PROVIDER: { label: "Not sent: not connected", variant: "warning" },
};

/** WhatsApp message log status. */
export function MessageStatusBadge({ status }: { status: string }) {
  const s = MESSAGE_STATUS[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
