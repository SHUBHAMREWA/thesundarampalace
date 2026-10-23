import { addDays, effectiveRange, rangesOverlap, type TimeRange } from "@/lib/time";

/**
 * Pure booking rules (banquet-business-rules skill). The services in
 * src/server/services enforce them; these functions only decide.
 */

export const BOOKING_STATUSES = [
  "ENQUIRY_HOLD",
  "TENTATIVE",
  "QUOTATION_SENT",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type ReservationState = "HOLD" | "TENTATIVE" | "CONFIRMED" | "RELEASED" | "CANCELLED";

/** Allowed status changes. Anything else is rejected by the booking service. */
const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  ENQUIRY_HOLD: ["TENTATIVE", "QUOTATION_SENT", "CONFIRMED", "CANCELLED"],
  TENTATIVE: ["ENQUIRY_HOLD", "QUOTATION_SENT", "CONFIRMED", "CANCELLED"],
  QUOTATION_SENT: ["TENTATIVE", "CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: BookingStatus): readonly BookingStatus[] {
  return TRANSITIONS[from];
}

/** Confirmed-or-later bookings count as firm (calendar, revenue, kitchen). */
export function isFirm(status: BookingStatus): boolean {
  return status === "CONFIRMED" || status === "IN_PROGRESS" || status === "COMPLETED";
}

/** Before confirmation, sales staff may edit; afterwards it needs `bookings.confirm`. */
export function isPreConfirmation(status: BookingStatus): boolean {
  return status === "ENQUIRY_HOLD" || status === "TENTATIVE" || status === "QUOTATION_SENT";
}

/** The state every active reservation takes when the booking has this status. */
export function reservationStateFor(status: BookingStatus): ReservationState {
  switch (status) {
    case "ENQUIRY_HOLD":
      return "HOLD";
    case "TENTATIVE":
    case "QUOTATION_SENT":
      return "TENTATIVE";
    case "CONFIRMED":
    case "IN_PROGRESS":
    case "COMPLETED":
      return "CONFIRMED";
    case "CANCELLED":
      return "CANCELLED";
  }
}

/** Reservations that still occupy (or claim) the hall. */
export function isActiveReservation(state: ReservationState): boolean {
  return state === "HOLD" || state === "TENTATIVE" || state === "CONFIRMED";
}

// ─── Conflicts ───────────────────────────────────────────────────────────────

export type Occupant = {
  reservationId: string;
  bookingId: string;
  bookingReference: string;
  subEventName: string;
  hallName: string;
  physicalHallId: string;
  /** Effective range (buffers already applied). */
  startsAt: Date;
  endsAt: Date;
  state: ReservationState;
  waitlistPosition: number | null;
};

export type Conflict = Occupant & { blocking: boolean };

export type Candidate = {
  bookingId: string;
  physicalHallIds: string[];
  /** Effective range (buffers already applied). */
  range: TimeRange;
  state: ReservationState;
};

/**
 * Conflict rule: same physical hall, overlapping effective ranges, and
 * CONFIRMED on both sides → blocking. Anything involving a hold or a
 * tentative reservation → warning. Different halls never conflict (a
 * composite hall is expanded into its member halls before calling this).
 * Reservations of the same booking are ignored.
 */
export function findConflicts(candidate: Candidate, occupants: Occupant[]): Conflict[] {
  const halls = new Set(candidate.physicalHallIds);
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();
  for (const other of occupants) {
    if (other.bookingId === candidate.bookingId) continue;
    if (!isActiveReservation(other.state)) continue;
    if (!halls.has(other.physicalHallId)) continue;
    if (!rangesOverlap(candidate.range, { startsAt: other.startsAt, endsAt: other.endsAt })) continue;
    if (seen.has(other.reservationId)) continue;
    seen.add(other.reservationId);
    conflicts.push({ ...other, blocking: candidate.state === "CONFIRMED" && other.state === "CONFIRMED" });
  }
  return conflicts.sort((a, b) => Number(b.blocking) - Number(a.blocking) || a.startsAt.getTime() - b.startsAt.getTime());
}

/** Effective range for a hall with its buffers. */
export function hallEffectiveRange(
  range: TimeRange,
  hall: { setupBufferMinutes: number; teardownBufferMinutes: number },
): TimeRange {
  return effectiveRange(range, hall.setupBufferMinutes, hall.teardownBufferMinutes);
}

/**
 * Physical halls occupied by booking `hallId`: a composite hall occupies its
 * members; an ordinary hall occupies itself.
 */
export function physicalHallsFor(hallId: string, compositions: { compositeHallId: string; memberHallId: string }[]): string[] {
  const members = compositions.filter((c) => c.compositeHallId === hallId).map((c) => c.memberHallId);
  return members.length ? members : [hallId];
}

// ─── Guest counts and plates ─────────────────────────────────────────────────

/** Guaranteed plates lock on this date ("YYYY-MM-DD"). */
export function guestCountLockDate(eventDate: string, lockDays: number): string {
  return addDays(eventDate, -lockDays);
}

export function isGuestCountLocked(today: string, eventDate: string, lockDays: number): boolean {
  return today >= guestCountLockDate(eventDate, lockDays);
}

/** Plates served beyond the guarantee are billed; a shortfall is refunded only if the policy says so. */
export function plateDifference(guaranteed: number, actual: number): { extra: number; shortfall: number } {
  return { extra: Math.max(0, actual - guaranteed), shortfall: Math.max(0, guaranteed - actual) };
}

// ─── Events ──────────────────────────────────────────────────────────────────

/** Main event types that show the bride and groom section. */
export const MARRIAGE_EVENT_TYPES = ["wedding", "engagement", "reception", "sangeet", "haldi_mehendi"] as const;

export function isMarriageEvent(eventTypeKey: string | null | undefined): boolean {
  return !!eventTypeKey && (MARRIAGE_EVENT_TYPES as readonly string[]).includes(eventTypeKey);
}
