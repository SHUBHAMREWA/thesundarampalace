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
  ENQUIRY_HOLD: "Enquiry hold",
  TENTATIVE: "Tentative",
  QUOTATION_SENT: "Quotation sent",
  CONFIRMED: "Confirmed",
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
  TENTATIVE: "Tentative",
  CONFIRMED: "Confirmed",
  RELEASED: "Released",
  CANCELLED: "Cancelled",
};

export function ReservationBadge({ state, waitlistPosition }: { state: string; waitlistPosition?: number | null }) {
  if (state === "HOLD" && waitlistPosition) return <Badge variant="outline">Waitlist #{waitlistPosition}</Badge>;
  const variant = state === "CONFIRMED" ? "success" : state === "HOLD" ? "info" : state === "TENTATIVE" ? "warning" : "secondary";
  return <Badge variant={variant}>{RESERVATION_LABEL[state] ?? state}</Badge>;
}
