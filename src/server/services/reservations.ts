import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  findConflicts,
  hallEffectiveRange,
  isActiveReservation,
  physicalHallsFor,
  type Conflict,
  type Occupant,
  type ReservationState,
} from "@/lib/booking/rules";
import { t } from "@/lib/i18n/localized";
import { formatIST, type TimeRange } from "@/lib/time";

import { recordActivity } from "./activity";
import { recordAudit } from "./audit";
import { isExclusionViolation, RuleError } from "./errors";
import { notifyStaff } from "./notifications";
import { getSettings } from "./settings";

/**
 * Hall reservations (banquet-business-rules skill). A sub-event's
 * reservation is expanded into one SlotOccupancy per physical hall with the
 * buffers applied; the PostgreSQL exclusion constraint on those rows is the
 * final guard against two confirmed bookings overlapping.
 */

export type Tx = Prisma.TransactionClient;

export class SlotConflictError extends RuleError {
  constructor(readonly conflicts: Conflict[]) {
    super(describeConflicts(conflicts, "This hall is already confirmed for"));
    this.name = "SlotConflictError";
  }
}

export function describeConflict(c: Conflict): string {
  return `${c.bookingReference} (${c.subEventName}, ${c.hallName}, ${formatIST(c.startsAt, "d MMM h:mm a")} – ${formatIST(c.endsAt, "d MMM h:mm a")} incl. setup/teardown, ${c.state.toLowerCase()}${c.waitlistPosition ? `, waitlist #${c.waitlistPosition}` : ""})`;
}

function describeConflicts(conflicts: Conflict[], lead: string): string {
  return `${lead} ${conflicts.map(describeConflict).join("; ")}.`;
}

/** Serialises reservation changes per physical hall inside the transaction (waitlist order stays consistent). */
async function lockHalls(tx: Tx, hallIds: string[]) {
  for (const id of [...new Set(hallIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`hall:${id}`}))`;
  }
}

export async function hallPlan(tx: Tx, hallId: string) {
  const hall = await tx.hall.findUnique({
    where: { id: hallId },
    select: { id: true, name: true, active: true, isComposite: true, setupBufferMinutes: true, teardownBufferMinutes: true, members: { select: { compositeHallId: true, memberHallId: true } } },
  });
  if (!hall) throw new RuleError("That hall no longer exists.");
  return { hall, physicalHallIds: physicalHallsFor(hall.id, hall.members) };
}

/** Active occupancies of other bookings that overlap `range` on any of the halls. */
export async function occupantsFor(tx: Tx, physicalHallIds: string[], range: TimeRange): Promise<Occupant[]> {
  const rows = await tx.slotOccupancy.findMany({
    where: {
      physicalHallId: { in: physicalHallIds },
      state: { in: ["HOLD", "TENTATIVE", "CONFIRMED"] },
      effectiveStartsAt: { lt: range.endsAt },
      effectiveEndsAt: { gt: range.startsAt },
    },
    select: {
      physicalHallId: true,
      effectiveStartsAt: true,
      effectiveEndsAt: true,
      state: true,
      physicalHall: { select: { name: true } },
      reservation: {
        select: {
          id: true,
          waitlistPosition: true,
          subEvent: { select: { name: true, booking: { select: { id: true, reference: true } } } },
        },
      },
    },
  });
  return rows.map((r) => ({
    reservationId: r.reservation.id,
    bookingId: r.reservation.subEvent.booking.id,
    bookingReference: r.reservation.subEvent.booking.reference,
    subEventName: r.reservation.subEvent.name,
    hallName: t(r.physicalHall.name, "en"),
    physicalHallId: r.physicalHallId,
    startsAt: r.effectiveStartsAt,
    endsAt: r.effectiveEndsAt,
    state: r.state as ReservationState,
    waitlistPosition: r.reservation.waitlistPosition,
  }));
}

/** Conflicts a sub-event would have in `state` (for previews and warnings). */
export async function previewConflicts(
  tx: Tx,
  input: { bookingId: string; hallId: string; range: TimeRange; state: ReservationState },
) {
  const { hall, physicalHallIds } = await hallPlan(tx, input.hallId);
  const effective = hallEffectiveRange(input.range, hall);
  const occupants = await occupantsFor(tx, physicalHallIds, effective);
  return findConflicts({ bookingId: input.bookingId, physicalHallIds, range: effective, state: input.state }, occupants);
}

export type SyncOptions = {
  actorId: string | null;
  /** Set when an authorised user overrides a confirmed-vs-confirmed conflict. */
  overrideReason?: string | null;
  now?: Date;
};

/**
 * Creates or updates the reservation (and its occupancies) of a sub-event so
 * it matches `state`. Returns warnings (holds/tentatives in the way).
 * Throws SlotConflictError for confirmed-vs-confirmed without an override.
 */
export async function syncReservation(
  tx: Tx,
  subEvent: { id: string; bookingId: string; hallId: string; startsAt: Date; endsAt: Date },
  state: ReservationState,
  options: SyncOptions,
): Promise<{ warnings: Conflict[]; waitlistPosition: number | null }> {
  const now = options.now ?? new Date();
  const { hall, physicalHallIds } = await hallPlan(tx, subEvent.hallId);
  if (isActiveReservation(state) && !hall.active) throw new RuleError(`${t(hall.name, "en")} is not active for bookings.`);
  const range = { startsAt: subEvent.startsAt, endsAt: subEvent.endsAt };
  const effective = hallEffectiveRange(range, hall);
  const existing = await tx.slotReservation.findUnique({ where: { subEventId: subEvent.id }, include: { occupancies: true } });
  const oldHalls = existing?.occupancies.map((o) => o.physicalHallId) ?? [];
  await lockHalls(tx, [...physicalHallIds, ...oldHalls]);

  let warnings: Conflict[] = [];
  let waitlistPosition: number | null = null;
  let holdExpiresAt: Date | null = null;
  let allowOverlap = false;

  if (isActiveReservation(state)) {
    const occupants = await occupantsFor(tx, physicalHallIds, effective);
    const conflicts = findConflicts({ bookingId: subEvent.bookingId, physicalHallIds, range: effective, state }, occupants);
    const blocking = conflicts.filter((c) => c.blocking);
    warnings = conflicts.filter((c) => !c.blocking);
    if (blocking.length) {
      if (!options.overrideReason) throw new SlotConflictError(blocking);
      allowOverlap = true;
      warnings = conflicts;
    }
    if (state === "HOLD") {
      // A hold on a slot someone else already holds or has booked joins the waitlist.
      const taken = conflicts.filter((c) => c.waitlistPosition === null);
      if (taken.length) {
        const sameKept = existing?.state === "HOLD" && existing.waitlistPosition !== null && sameRange(existing, range) ? existing.waitlistPosition : null;
        waitlistPosition = sameKept ?? Math.max(0, ...conflicts.map((c) => c.waitlistPosition ?? 0)) + 1;
      } else {
        const keepExpiry = existing?.state === "HOLD" && existing.waitlistPosition === null && existing.holdExpiresAt && existing.holdExpiresAt > now && sameRange(existing, range);
        if (keepExpiry) holdExpiresAt = existing.holdExpiresAt;
        else {
          const { holdDurationHours } = await getSettings("bookingPolicy");
          holdExpiresAt = new Date(now.getTime() + holdDurationHours * 3_600_000);
        }
      }
    }
  }

  const data = {
    hallId: subEvent.hallId,
    startsAt: subEvent.startsAt,
    endsAt: subEvent.endsAt,
    state,
    holdExpiresAt,
    holdReminderSentAt: holdExpiresAt && existing?.holdExpiresAt?.getTime() === holdExpiresAt.getTime() ? existing.holdReminderSentAt : null,
    waitlistPosition,
    overrideReason: allowOverlap ? options.overrideReason!.slice(0, 500) : null,
    overrideById: allowOverlap ? options.actorId : null,
  };
  const reservation = existing
    ? await tx.slotReservation.update({ where: { id: existing.id }, data })
    : await tx.slotReservation.create({ data: { subEventId: subEvent.id, ...data } });
  await tx.slotOccupancy.deleteMany({ where: { reservationId: reservation.id } });
  try {
    await tx.slotOccupancy.createMany({
      data: physicalHallIds.map((physicalHallId) => ({
        reservationId: reservation.id,
        physicalHallId,
        effectiveStartsAt: effective.startsAt,
        effectiveEndsAt: effective.endsAt,
        state,
        allowOverlap,
      })),
    });
  } catch (error) {
    if (isExclusionViolation(error)) {
      throw new RuleError("Another booking was confirmed for this hall and time a moment ago. Refresh to see it, then choose another slot or hall.");
    }
    throw error;
  }
  if (allowOverlap) {
    await recordAudit(
      { actorId: options.actorId, action: "booking.conflict_overridden", entityType: "slot_reservation", entityId: reservation.id, summary: { reason: options.overrideReason!.slice(0, 500), conflicts: warnings.map((c) => c.bookingReference) } },
      tx,
    );
  }
  // The old range or halls may have freed a slot someone is waiting for.
  if (existing && isActiveReservation(existing.state as ReservationState) && (!isActiveReservation(state) || !sameRange(existing, range) || existing.hallId !== subEvent.hallId)) {
    for (const occ of existing.occupancies) {
      await promoteWaitlist(tx, [occ.physicalHallId], { startsAt: occ.effectiveStartsAt, endsAt: occ.effectiveEndsAt }, now);
    }
  }
  return { warnings, waitlistPosition };
}

function sameRange(a: { startsAt: Date; endsAt: Date }, b: TimeRange) {
  return a.startsAt.getTime() === b.startsAt.getTime() && a.endsAt.getTime() === b.endsAt.getTime();
}

/** Releases a sub-event's reservation (cancelled booking, removed sub-event). */
export async function releaseReservation(tx: Tx, subEventId: string, state: "RELEASED" | "CANCELLED", now: Date = new Date()) {
  const existing = await tx.slotReservation.findUnique({ where: { subEventId }, include: { occupancies: true } });
  if (!existing || !isActiveReservation(existing.state as ReservationState)) return;
  await lockHalls(tx, existing.occupancies.map((o) => o.physicalHallId));
  await tx.slotReservation.update({ where: { id: existing.id }, data: { state, holdExpiresAt: null, waitlistPosition: null } });
  await tx.slotOccupancy.updateMany({ where: { reservationId: existing.id }, data: { state } });
  for (const occ of existing.occupancies) {
    await promoteWaitlist(tx, [occ.physicalHallId], { startsAt: occ.effectiveStartsAt, endsAt: occ.effectiveEndsAt }, now);
  }
}

/**
 * After a slot frees up: waitlisted holds that no longer overlap any active,
 * non-waitlisted reservation become real holds (with a fresh expiry) and the
 * booking owner is notified. Remaining waitlist entries are renumbered.
 */
export async function promoteWaitlist(tx: Tx, physicalHallIds: string[], range: TimeRange, now: Date = new Date()) {
  const waiting = await tx.slotReservation.findMany({
    where: {
      state: "HOLD",
      waitlistPosition: { not: null },
      occupancies: { some: { physicalHallId: { in: physicalHallIds }, effectiveStartsAt: { lt: range.endsAt }, effectiveEndsAt: { gt: range.startsAt } } },
    },
    orderBy: [{ waitlistPosition: "asc" }, { createdAt: "asc" }],
    include: { occupancies: true, subEvent: { select: { id: true, name: true, booking: { select: { id: true, reference: true, ownerId: true, createdById: true } } } } },
  });
  if (!waiting.length) return;
  const { holdDurationHours } = await getSettings("bookingPolicy");
  const stillWaiting: typeof waiting = [];
  for (const entry of waiting) {
    let blocked = false;
    for (const occ of entry.occupancies) {
      const others = await occupantsFor(tx, [occ.physicalHallId], { startsAt: occ.effectiveStartsAt, endsAt: occ.effectiveEndsAt });
      if (others.some((o) => o.bookingId !== entry.subEvent.booking.id && o.waitlistPosition === null && o.reservationId !== entry.id)) blocked = true;
    }
    if (blocked) {
      stillWaiting.push(entry);
      continue;
    }
    const holdExpiresAt = new Date(now.getTime() + holdDurationHours * 3_600_000);
    await tx.slotReservation.update({ where: { id: entry.id }, data: { waitlistPosition: null, holdExpiresAt, holdReminderSentAt: null } });
    const booking = entry.subEvent.booking;
    await recordActivity({ entityType: "booking", entityId: booking.id, kind: "WAITLIST_PROMOTED", message: `${entry.subEvent.name}: the slot became free — the waitlisted hold is now active until ${formatIST(holdExpiresAt)}` }, tx);
    const owner = booking.ownerId ?? booking.createdById;
    if (owner) {
      await notifyStaff(tx, {
        userIds: [owner],
        kind: "hold.promoted",
        title: `${booking.reference}: waitlisted hold is now active`,
        body: `${entry.subEvent.name} — the hall became free. The hold expires ${formatIST(holdExpiresAt)}.`,
        link: `/admin/bookings/${booking.id}`,
      });
    }
  }
  for (const [index, entry] of stillWaiting.entries()) {
    if (entry.waitlistPosition !== index + 1) {
      await tx.slotReservation.update({ where: { id: entry.id }, data: { waitlistPosition: index + 1 } });
    }
  }
}

/**
 * Releases holds whose time is up. Runs lazily before booking pages read
 * reservations and from the hourly job, so nothing depends on exact timing.
 */
export async function releaseExpiredHolds(now: Date = new Date()): Promise<number> {
  const expired = await db.slotReservation.findMany({
    where: { state: "HOLD", waitlistPosition: null, holdExpiresAt: { lte: now } },
    select: { id: true, subEventId: true },
    take: 200,
  });
  let released = 0;
  for (const row of expired) {
    await db.$transaction(async (tx) => {
      const current = await tx.slotReservation.findUnique({
        where: { id: row.id },
        include: { subEvent: { select: { name: true, booking: { select: { id: true, reference: true, ownerId: true, createdById: true } } } } },
      });
      if (!current || current.state !== "HOLD" || !current.holdExpiresAt || current.holdExpiresAt > now) return;
      await releaseReservation(tx, row.subEventId, "RELEASED", now);
      const booking = current.subEvent.booking;
      await recordActivity({ entityType: "booking", entityId: booking.id, kind: "HOLD_EXPIRED", message: `${current.subEvent.name}: hold expired and the slot was released` }, tx);
      await recordAudit({ action: "hold.expired", entityType: "slot_reservation", entityId: current.id, summary: { booking: booking.reference } }, tx);
      const owner = booking.ownerId ?? booking.createdById;
      if (owner) {
        await notifyStaff(tx, {
          userIds: [owner],
          kind: "hold.expired",
          title: `${booking.reference}: hold expired`,
          body: `${current.subEvent.name} — the slot was released.`,
          link: `/admin/bookings/${booking.id}`,
        });
      }
      released += 1;
    });
  }
  return released;
}

/** Notifies the booking owner once when a hold is about to expire. */
export async function sendHoldReminders(now: Date = new Date()): Promise<number> {
  const { holdReminderHoursBefore } = await getSettings("bookingPolicy");
  if (holdReminderHoursBefore <= 0) return 0;
  const soon = new Date(now.getTime() + holdReminderHoursBefore * 3_600_000);
  const due = await db.slotReservation.findMany({
    where: { state: "HOLD", waitlistPosition: null, holdReminderSentAt: null, holdExpiresAt: { gt: now, lte: soon } },
    include: { subEvent: { select: { name: true, booking: { select: { id: true, reference: true, ownerId: true, createdById: true } } } } },
    take: 200,
  });
  for (const row of due) {
    const booking = row.subEvent.booking;
    const owner = booking.ownerId ?? booking.createdById;
    await db.$transaction(async (tx) => {
      await tx.slotReservation.update({ where: { id: row.id }, data: { holdReminderSentAt: now } });
      if (owner) {
        await notifyStaff(tx, {
          userIds: [owner],
          kind: "hold.expiring",
          title: `${booking.reference}: hold expires ${formatIST(row.holdExpiresAt!, "d MMM, h:mm a")}`,
          body: `${row.subEvent.name} — extend it by confirming, or it will be released.`,
          link: `/admin/bookings/${booking.id}`,
          email: { subject: `Hold expiring: ${booking.reference}`, text: `The hold for ${booking.reference} (${row.subEvent.name}) expires ${formatIST(row.holdExpiresAt!)}.\nOpen the CRM to confirm or release it.` },
          related: { type: "booking", id: booking.id },
        });
      }
    });
  }
  return due.length;
}
