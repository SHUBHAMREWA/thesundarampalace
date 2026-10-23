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
