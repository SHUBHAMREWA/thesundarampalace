import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import {
  canTransition,
  isFirm,
  isGuestCountLocked,
  isPreConfirmation,
  isStepBack,
  reservationStateFor,
  type BookingStatus,
} from "@/lib/booking/rules";
import { MENU_COURSES } from "@/lib/content/catalog";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import {
  cancellationRefund,
  depositTotals,
  formatINR,
  ledgerTotals,
  money,
  roundMoney,
} from "@/lib/money";
import {
  dateFromKey,
  dateKey,
  daysBetween,
  formatDateKey,
  slotRange,
  todayIST,
} from "@/lib/time";
import {
  dateKeySchema,
  optionalDateKey,
  optionalEmail,
  optionalMoneyString,
  optionalPhone,
  optionalPositiveInt,
  optionalText,
  positiveInt,
  requiredText,
  timeSchema,
} from "@/lib/validation/forms";
import {
  assertPermission,
  can,
  ForbiddenError,
  type Actor,
} from "@/server/policies/authorize";

import { recordActivity } from "./activity";
import { recordAudit } from "./audit";
import { parseSelectionRules, parseSlabs } from "./catalog";
import { fieldError, RuleError } from "./errors";
import { NotFoundError } from "./leads";
import { nextBookingReference } from "./numbering";
import {
  previewConflicts,
  releaseExpiredHolds,
  releaseReservation,
  syncReservation,
  type Tx,
} from "./reservations";
import { getSettings } from "./settings";

/**
 * Bookings and sub-events (MASTER_PROMPT §9–11). Status changes are
 * validated here (lib/booking/rules.ts), never in the UI.
 *
 * Permissions: `bookings.edit` before confirmation; `bookings.confirm` to
 * confirm, cancel or change a confirmed booking; `holds.place` for holds;
 * `bookings.override_conflict` (with a reason) to double-book a hall.
 */

export function bookingVisibility(actor: Actor): Prisma.BookingWhereInput {
  assertPermission(actor, "bookings.read");
  if (can(actor, "bookings.read_all")) return { deletedAt: null };
  return {
    deletedAt: null,
    OR: [
      { ownerId: actor.id },
      { subEvents: { some: { assignedToId: actor.id } } },
    ],
  };
}

async function requireBooking(actor: Actor, id: string, tx: Tx = db) {
  const booking = await tx.booking.findFirst({
    where: { AND: [{ id }, bookingVisibility(actor)] },
  });
  if (!booking) throw new NotFoundError("Booking");
  return booking;
}

/** Editing rights depend on the booking's stage. */
export function assertCanEdit(actor: Actor, status: BookingStatus) {
  if (status === "CANCELLED" || status === "COMPLETED")
    throw new RuleError(
      `This booking is ${status.toLowerCase()} and can't be changed.`,
    );
  assertPermission(
    actor,
    isPreConfirmation(status) ? "bookings.edit" : "bookings.confirm",
  );
}

export function canEditBooking(actor: Actor, status: BookingStatus): boolean {
  if (status === "CANCELLED" || status === "COMPLETED") return false;
  return can(
    actor,
    isPreConfirmation(status) ? "bookings.edit" : "bookings.confirm",
  );
}

async function logStatus(
  tx: Tx,
  bookingId: string,
  from: BookingStatus | null,
  to: BookingStatus,
  actorId: string | null,
  reason?: string | null,
) {
  await tx.bookingStatusHistory.create({
    data: {
      bookingId,
      fromStatus: from,
      toStatus: to,
      actorId,
      reason: reason ?? null,
    },
  });
}

/**
 * The event dates (from – to) are entered on the booking. A function added
 * outside that range widens it, so the booking always covers its functions.
 */
async function refreshDates(tx: Tx, bookingId: string) {
  const agg = await tx.bookingSubEvent.aggregate({
    where: { bookingId },
    _min: { date: true },
    _max: { date: true },
  });
  if (!agg._min.date || !agg._max.date) return;
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { startDate: true, endDate: true },
  });
  const start =
    booking.startDate && booking.startDate < agg._min.date
      ? booking.startDate
      : agg._min.date;
  const end =
    booking.endDate && booking.endDate > agg._max.date
      ? booking.endDate
      : agg._max.date;
  await tx.booking.update({
    where: { id: bookingId },
    data: { startDate: start, endDate: end },
  });
}

/** "From" and "to" of the event; "to" defaults to "from" (a one-day event). */
function eventRange(input: {
  eventFrom?: string | null;
  eventTo?: string | null;
}) {
  if (!input.eventFrom) return null;
  const to = input.eventTo || input.eventFrom;
  if (to < input.eventFrom)
    fieldError("eventTo", "The event can't end before it starts");
  return { startDate: dateFromKey(input.eventFrom), endDate: dateFromKey(to) };
}

// ─── Lists ───────────────────────────────────────────────────────────────────

export const BOOKING_PAGE_SIZE = 25;

export const bookingListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.string().max(30).optional().catch(undefined),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  hallId: z.string().max(50).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export async function listBookings(
  actor: Actor,
  query: z.infer<typeof bookingListQuerySchema>,
) {
  const and: Prisma.BookingWhereInput[] = [bookingVisibility(actor)];
  if (query.q) {
    and.push({
      OR: [
        { reference: { contains: query.q.toUpperCase() } },
        { mainEventName: { contains: query.q, mode: "insensitive" } },
        ...(can(actor, "customers.read")
          ? [
              {
                customer: {
                  fullName: { contains: query.q, mode: "insensitive" as const },
                },
              },
              ...(query.q.replace(/\D/g, "").length >= 4
                ? [
                    {
                      customer: {
                        mobile: { contains: query.q.replace(/\D/g, "") },
                      },
                    },
                  ]
                : []),
            ]
          : []),
      ],
    });
  }
  if (
    query.status &&
    (
      [
        "ENQUIRY_HOLD",
        "TENTATIVE",
        "QUOTATION_SENT",
        "CONFIRMED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ] as string[]
    ).includes(query.status)
  ) {
    and.push({ status: query.status as BookingStatus });
  }
  if (query.from) and.push({ endDate: { gte: dateFromKey(query.from) } });
  if (query.to) and.push({ startDate: { lte: dateFromKey(query.to) } });
  if (query.hallId) and.push({ subEvents: { some: { hallId: query.hallId } } });
  const where = { AND: and };
  const [total, rows] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      orderBy: [
        { startDate: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      skip: (query.page - 1) * BOOKING_PAGE_SIZE,
      take: BOOKING_PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        mainEventName: true,
        mainEventTypeKey: true,
        status: true,
        startDate: true,
        endDate: true,
        expectedGuests: true,
        customer: { select: { fullName: true, mobile: true, whatsapp: true } },
        _count: { select: { subEvents: true } },
      },
    }),
  ]);
  const shaped = rows.map((r) => ({
    ...r,
    customer: can(actor, "customers.read") ? r.customer : null,
  }));
  return {
    total,
    rows: shaped,
    pageCount: Math.max(1, Math.ceil(total / BOOKING_PAGE_SIZE)),
  };
}

/** How many bookings the actor can see in each status (for the summary chips). */
export async function bookingStatusCounts(
  actor: Actor,
): Promise<Partial<Record<BookingStatus, number>>> {
  assertPermission(actor, "bookings.read");
  const groups = await db.booking.groupBy({
    by: ["status"],
    where: bookingVisibility(actor),
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.status, g._count._all]));
}

// ─── Create and edit ─────────────────────────────────────────────────────────

export const bookingDetailsSchema = z.object({
  mainEventName: requiredText("Event name", 160),
  mainEventTypeKey: requiredText("Event type", 50),
  expectedGuests: optionalPositiveInt(100_000),
  ownerId: optionalText(50),
  /** What the booking was agreed for (an accepted quotation's total takes over once there is one). */
  bookingAmount: optionalMoneyString,
  /** The day the booking was taken. */
  bookedOn: optionalDateKey,
  /** Event dates; "to" may be left empty for a one-day event. */
  eventFrom: optionalDateKey,
  eventTo: optionalDateKey,
  notes: optionalText(4000),
  internalInstructions: optionalText(4000),
});

export const createBookingSchema = bookingDetailsSchema.extend({
  customerId: requiredText("Customer", 50),
  leadId: optionalText(50),
  /** Not on the form (tests only): every new booking starts as Booked (TENTATIVE). */
  initialStatus: z.enum(["ENQUIRY_HOLD", "TENTATIVE"]).optional(),
  /** Advance taken when the booking is made; recorded as its first payment. */
  advanceAmount: optionalMoneyString,
  advanceMethod: optionalText(20),
});

async function validateBookingRefs(
  input: z.infer<typeof bookingDetailsSchema>,
) {
  const type = await db.lookupValue.findFirst({
    where: { listKey: "event_type", key: input.mainEventTypeKey },
  });
  if (!type) fieldError("mainEventTypeKey", "Choose an event type");
  if (input.ownerId) {
    const owner = await db.user.findFirst({
      where: {
        id: input.ownerId,
        active: true,
        roles: {
          some: {
            role: { permissions: { some: { permissionKey: "bookings.edit" } } },
          },
        },
      },
    });
    if (!owner)
      fieldError(
        "ownerId",
        "Choose an active staff member who handles bookings",
      );
  }
}

export async function createBooking(
  actor: Actor,
  input: z.infer<typeof createBookingSchema>,
) {
  assertPermission(actor, "bookings.edit");
  // Three statuses only (owner, 29 Oct 2026): Booked → Completed, or Cancelled.
  // "Booked" is CONFIRMED, so a new booking is firm at once and carries today's cancellation policy.
  const status = input.initialStatus ?? "CONFIRMED";
  if (status === "ENQUIRY_HOLD") assertPermission(actor, "holds.place");
  const range = eventRange(input);
  await validateBookingRefs(input);
  const customer = await db.customer.findFirst({
    where: { id: input.customerId, deletedAt: null },
  });
  if (!customer) fieldError("customerId", "Choose a customer");
  if (input.leadId) {
    const lead = await db.lead.findFirst({
      where: { id: input.leadId, deletedAt: null },
    });
    if (!lead) fieldError("leadId", "The lead no longer exists");
  }
  const { bookingPrefix } = await getSettings("numbering");
  return db.$transaction(async (tx) => {
    const reference = await nextBookingReference(tx, new Date(), bookingPrefix);
    const booking = await tx.booking.create({
      data: {
        reference,
        customerId: customer.id,
        leadId: input.leadId,
        mainEventName: input.mainEventName,
        mainEventTypeKey: input.mainEventTypeKey,
        status,
        startDate: range?.startDate ?? null,
        endDate: range?.endDate ?? null,
        bookedOn: dateFromKey(input.bookedOn ?? todayIST()),
        ...(status === "CONFIRMED"
          ? {
              confirmedAt: new Date(),
              confirmedById: actor.id,
              cancellationPolicySnapshot:
                (await snapshotCancellationPolicy()) ?? undefined,
            }
          : {}),
        expectedGuests: input.expectedGuests,
        ownerId: input.ownerId ?? actor.id,
        bookingAmount: input.bookingAmount,
        notes: input.notes,
        internalInstructions: input.internalInstructions,
        createdById: actor.id,
      },
    });
    await logStatus(tx, booking.id, null, status, actor.id, "Created");
    if (input.leadId) {
      await tx.lead.update({
        where: { id: input.leadId },
        data: { customerId: customer.id, lastActivityAt: new Date() },
      });
      await tx.leadActivity.create({
        data: {
          leadId: input.leadId,
          kind: "NOTE",
          actorId: actor.id,
          note: `Booking ${reference} created`,
        },
      });
    }
    await recordActivity(
      {
        entityType: "booking",
        entityId: booking.id,
        actorId: actor.id,
        kind: "CREATED",
        message: "Booking created",
      },
      tx,
    );
    await recordActivity(
      {
        entityType: "customer",
        entityId: customer.id,
        actorId: actor.id,
        kind: "BOOKING",
        message: `Booking ${reference} created`,
      },
      tx,
    );
    await recordAudit(
      {
        actorId: actor.id,
        action: "booking.created",
        entityType: "booking",
        entityId: booking.id,
        summary: { reference, customer: customer.reference },
      },
      tx,
    );
    return booking;
  });
}

export async function updateBookingDetails(
  actor: Actor,
  id: string,
  input: z.infer<typeof bookingDetailsSchema>,
) {
  const booking = await requireBooking(actor, id);
  assertCanEdit(actor, booking.status);
  await validateBookingRefs(input);
  const range = eventRange(input);
  const data = {
    mainEventName: input.mainEventName,
    mainEventTypeKey: input.mainEventTypeKey,
    expectedGuests: input.expectedGuests,
    ownerId: input.ownerId ?? booking.ownerId,
    bookingAmount: input.bookingAmount,
    ...(input.bookedOn ? { bookedOn: dateFromKey(input.bookedOn) } : {}),
    ...(range ?? {}),
    notes: input.notes,
    internalInstructions: input.internalInstructions,
  };
  const changed = Object.entries(data)
    .filter(([key, value]) => {
      const old = (booking as Record<string, unknown>)[key];
      const a =
        old === null || old === undefined
          ? null
          : typeof old === "object" && "toFixed" in (old as object)
            ? (old as { toFixed(n: number): string }).toFixed(2)
            : String(old);
      const b = value === null || value === undefined ? null : String(value);
      return a !== b;
    })
    .map(([key]) => key);
  if (!changed.length) return;
  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id }, data });
    await recordActivity(
      {
        entityType: "booking",
        entityId: id,
        actorId: actor.id,
        kind: "UPDATED",
        message: `Updated: ${changed.join(", ")}`,
      },
      tx,
    );
    if (isFirm(booking.status))
      await recordAudit(
        {
          actorId: actor.id,
          action: "booking.confirmed_updated",
          entityType: "booking",
          entityId: id,
          summary: { fields: changed },
        },
        tx,
      );
  });
}

// ─── Sub-events ──────────────────────────────────────────────────────────────

export const subEventSchema = z
  .object({
    name: requiredText("Function name", 120),
    eventTypeKey: requiredText("Function type", 50),
    date: dateKeySchema,
    hallId: requiredText("Hall", 50),
    startTime: timeSchema,
    endTime: timeSchema,
    expectedGuests: optionalPositiveInt(100_000),
    assignedToId: optionalText(50),
    specialInstructions: optionalText(2000),
    internalNotes: optionalText(2000),
    dietaryNotes: optionalText(1000),
    overrideReason: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.startTime === v.endTime)
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "Start and end can't be the same",
      });
  });
export type SubEventInput = z.infer<typeof subEventSchema>;

async function resolveSubEventTimes(input: SubEventInput) {
  const hall = await db.hall.findUnique({ where: { id: input.hallId } });
  if (!hall || !hall.active) fieldError("hallId", "Choose an active hall");
  const type = await db.lookupValue.findFirst({
    where: { listKey: "sub_event_type", key: input.eventTypeKey },
  });
  if (!type) fieldError("eventTypeKey", "Choose a function type");
  if (
    input.assignedToId &&
    !(await db.user.findFirst({
      where: { id: input.assignedToId, active: true },
    }))
  )
    fieldError("assignedToId", "Choose an active staff member");
  // Times are typed per function (no fixed slots); an end before the start means the next day.
  return {
    slotDefinitionId: null,
    ...slotRange(input.date, input.startTime, input.endTime),
  };
}

function overrideFor(actor: Actor, reason: string | null) {
  if (!reason) return null;
  assertPermission(actor, "bookings.override_conflict");
  return reason;
}

/** Shows conflicts before saving (no changes are made). */
export async function checkAvailability(
  actor: Actor,
  bookingId: string | null,
  input: SubEventInput,
) {
  assertPermission(actor, "bookings.read");
  const times = await resolveSubEventTimes(input);
  const booking = bookingId ? await requireBooking(actor, bookingId) : null;
  const state = booking ? reservationStateFor(booking.status) : "CONFIRMED";
  const conflicts = await previewConflicts(db, {
    bookingId: bookingId ?? "",
    hallId: input.hallId,
    range: times,
    state: state === "CANCELLED" ? "CONFIRMED" : state,
  });
  return { range: times, conflicts };
}

export async function addSubEvent(
  actor: Actor,
  bookingId: string,
  input: SubEventInput,
) {
  const booking = await requireBooking(actor, bookingId);
  assertCanEdit(actor, booking.status);
  const state = reservationStateFor(booking.status);
  if (state === "HOLD") assertPermission(actor, "holds.place");
  const times = await resolveSubEventTimes(input);
  const overrideReason = overrideFor(actor, input.overrideReason);
  return db.$transaction(async (tx) => {
    const count = await tx.bookingSubEvent.count({ where: { bookingId } });
    const subEvent = await tx.bookingSubEvent.create({
      data: {
        bookingId,
        name: input.name,
        eventTypeKey: input.eventTypeKey,
        date: dateFromKey(input.date),
        hallId: input.hallId,
        slotDefinitionId: times.slotDefinitionId,
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        expectedGuests: input.expectedGuests,
        assignedToId: input.assignedToId,
        specialInstructions: input.specialInstructions,
        internalNotes: input.internalNotes,
        dietaryNotes: input.dietaryNotes,
        sortOrder: (count + 1) * 10,
      },
    });
    const result = await syncReservation(tx, subEvent, state, {
      actorId: actor.id,
      overrideReason,
    });
    await refreshDates(tx, bookingId);
    await recordActivity(
      {
        entityType: "booking",
        entityId: bookingId,
        actorId: actor.id,
        kind: "SUB_EVENT",
        message: `Added ${input.name} on ${formatDateKey(input.date)}${result.waitlistPosition ? ` (waitlist #${result.waitlistPosition})` : ""}`,
      },
      tx,
    );
    return { subEvent, ...result };
  });
}

export async function updateSubEvent(
  actor: Actor,
  subEventId: string,
  input: SubEventInput,
) {
  const existing = await db.bookingSubEvent.findUnique({
    where: { id: subEventId },
  });
  if (!existing) throw new NotFoundError("Function");
  const booking = await requireBooking(actor, existing.bookingId);
  assertCanEdit(actor, booking.status);
  const times = await resolveSubEventTimes(input);
  const overrideReason = overrideFor(actor, input.overrideReason);
  const state = reservationStateFor(booking.status);
  return db.$transaction(async (tx) => {
    const subEvent = await tx.bookingSubEvent.update({
      where: { id: subEventId },
      data: {
        name: input.name,
        eventTypeKey: input.eventTypeKey,
        date: dateFromKey(input.date),
        hallId: input.hallId,
        slotDefinitionId: times.slotDefinitionId,
        startsAt: times.startsAt,
        endsAt: times.endsAt,
        expectedGuests: input.expectedGuests,
        assignedToId: input.assignedToId,
        specialInstructions: input.specialInstructions,
        internalNotes: input.internalNotes,
        dietaryNotes: input.dietaryNotes,
      },
    });
    const reservation = await tx.slotReservation.findUnique({
      where: { subEventId },
    });
    const moved =
      existing.hallId !== subEvent.hallId ||
      existing.startsAt.getTime() !== subEvent.startsAt.getTime() ||
      existing.endsAt.getTime() !== subEvent.endsAt.getTime();
    let result: Awaited<ReturnType<typeof syncReservation>> = {
      warnings: [],
      waitlistPosition: reservation?.waitlistPosition ?? null,
    };
    // A released hold stays released unless the time or hall changes (then it is re-placed).
    if (
      moved ||
      !reservation ||
      reservation.state !== "RELEASED" ||
      overrideReason
    ) {
      if (state === "HOLD") assertPermission(actor, "holds.place");
      result = await syncReservation(tx, subEvent, state, {
        actorId: actor.id,
        overrideReason,
      });
    }
    await refreshDates(tx, existing.bookingId);
    await recordActivity(
      {
        entityType: "booking",
        entityId: existing.bookingId,
        actorId: actor.id,
        kind: "SUB_EVENT",
        message: `Updated ${subEvent.name}${moved ? ` (now ${formatDateKey(input.date)})` : ""}`,
      },
      tx,
    );
    if (isFirm(booking.status) && moved) {
      await recordAudit(
        {
          actorId: actor.id,
          action: "booking.sub_event_moved",
          entityType: "booking",
          entityId: booking.id,
          summary: {
            subEvent: subEvent.name,
            from: existing.startsAt.toISOString(),
            to: subEvent.startsAt.toISOString(),
            hallChanged: existing.hallId !== subEvent.hallId,
          },
        },
        tx,
      );
    }
    return { subEvent, ...result };
  });
}

export async function removeSubEvent(
  actor: Actor,
  subEventId: string,
  reason: string | null,
) {
  const existing = await db.bookingSubEvent.findUnique({
    where: { id: subEventId },
    include: { _count: { select: { postEventCharges: true } } },
  });
  if (!existing) throw new NotFoundError("Function");
  const booking = await requireBooking(actor, existing.bookingId);
  assertCanEdit(actor, booking.status);
  if (existing._count.postEventCharges)
    throw new RuleError(
      "This function has post-event charges, so it can't be removed.",
    );
  if (isFirm(booking.status) && !reason)
    fieldError(
      "reason",
      "Give a reason for removing a function from a confirmed booking",
    );
  await db.$transaction(async (tx) => {
    await releaseReservation(tx, subEventId, "CANCELLED");
    await tx.bookingSubEvent.delete({ where: { id: subEventId } });
    await refreshDates(tx, existing.bookingId);
    await recordActivity(
      {
        entityType: "booking",
        entityId: existing.bookingId,
        actorId: actor.id,
        kind: "SUB_EVENT",
        message: `Removed ${existing.name}${reason ? ` — ${reason}` : ""}`,
      },
      tx,
    );
    await recordAudit(
      {
        actorId: actor.id,
        action: "booking.sub_event_removed",
        entityType: "booking",
        entityId: booking.id,
        summary: {
          subEvent: existing.name,
          date: dateKey(existing.date),
          reason,
        },
      },
      tx,
    );
  });
}

export async function moveSubEvent(
  actor: Actor,
  subEventId: string,
  direction: "up" | "down",
) {
  const existing = await db.bookingSubEvent.findUnique({
    where: { id: subEventId },
  });
  if (!existing) throw new NotFoundError("Function");
  const booking = await requireBooking(actor, existing.bookingId);
  assertCanEdit(actor, booking.status);
  const siblings = await db.bookingSubEvent.findMany({
    where: { bookingId: existing.bookingId },
    orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
  });
  const index = siblings.findIndex((s) => s.id === subEventId);
  const swapWith = siblings[direction === "up" ? index - 1 : index + 1];
  if (!swapWith) return;
  const ordered = [...siblings];
  ordered[index] = swapWith;
  ordered[direction === "up" ? index - 1 : index + 1] = existing;
  await db.$transaction(
    ordered.map((s, i) =>
      db.bookingSubEvent.update({
        where: { id: s.id },
        data: { sortOrder: (i + 1) * 10 },
      }),
    ),
  );
}

// ─── Status ──────────────────────────────────────────────────────────────────

export const statusChangeSchema = z.object({
  to: z.enum([
    "ENQUIRY_HOLD",
    "TENTATIVE",
    "QUOTATION_SENT",
    "CONFIRMED",
    "IN_PROGRESS",
    "COMPLETED",
  ]),
  reason: optionalText(500),
  overrideReason: optionalText(500),
});

function permissionFor(from: BookingStatus, to: BookingStatus) {
  if (to === "CONFIRMED" || !isPreConfirmation(from))
    return "bookings.confirm" as const;
  if (to === "ENQUIRY_HOLD") return "holds.place" as const;
  return "bookings.edit" as const;
}

/**
 * Moves a booking through its states and brings every reservation along.
 * Confirming needs an accepted quotation and snapshots the cancellation
 * policy; confirmed-vs-confirmed clashes need an override with a reason.
 * (Cancellation has its own flow: cancelBooking.)
 */
export async function changeBookingStatus(
  actor: Actor,
  id: string,
  input: z.infer<typeof statusChangeSchema>,
) {
  await releaseExpiredHolds();
  const booking = await requireBooking(actor, id);
  const to = input.to as BookingStatus;
  if (!canTransition(booking.status, to))
    throw new RuleError(
      `A ${booking.status.replace("_", " ").toLowerCase()} booking can't move to ${to.replace("_", " ").toLowerCase()}.`,
    );
  assertPermission(actor, permissionFor(booking.status, to));
  const overrideReason = overrideFor(actor, input.overrideReason);
  const subEvents = await db.bookingSubEvent.findMany({
    where: { bookingId: id },
    orderBy: { startsAt: "asc" },
  });
  const now = new Date();
  const data: Prisma.BookingUpdateInput = { status: to };
  if (isStepBack(booking.status, to)) {
    if (!input.reason?.trim())
      fieldError("reason", "Say why the status is being moved back");
    if (to === "TENTATIVE") {
      // Re-confirming later records a new confirmation and policy snapshot.
      data.confirmedAt = null;
      data.confirmedById = null;
    }
  }
  if (to === "CONFIRMED" && !isFirm(booking.status)) {
    if (!booking.acceptedQuotationId && !booking.bookingAmount)
      throw new RuleError(
        "Enter the booking amount (Edit details) or accept a quotation before confirming, so the agreed price is on record.",
      );
    const policy = await snapshotCancellationPolicy();
    data.cancellationPolicySnapshot = policy ?? undefined;
    data.confirmedAt = now;
    data.confirmedById = actor.id;
  }
  const state = reservationStateFor(to);
  const sameState = reservationStateFor(booking.status) === state;
  const warnings: string[] = [];
  await db.$transaction(
    async (tx) => {
      if (!sameState) {
        for (const subEvent of subEvents) {
          const reservation = await tx.slotReservation.findUnique({
            where: { subEventId: subEvent.id },
          });
          const result = await syncReservation(tx, subEvent, state, {
            actorId: actor.id,
            overrideReason,
            now,
          });
          if (reservation?.state === "RELEASED" && state !== "HOLD")
            warnings.push(
              `${subEvent.name}: the earlier hold had expired; the slot is reserved again.`,
            );
          for (const c of result.warnings)
            warnings.push(
              `${subEvent.name}: ${c.bookingReference} also has this time (${c.state.toLowerCase()}).`,
            );
        }
      }
      await tx.booking.update({ where: { id }, data });
      await logStatus(tx, id, booking.status, to, actor.id, input.reason);
      await recordActivity(
        {
          entityType: "booking",
          entityId: id,
          actorId: actor.id,
          kind: "STATUS",
          message: `Status: ${booking.status} → ${to}${input.reason ? ` — ${input.reason}` : ""}`,
        },
        tx,
      );
      await recordAudit(
        {
          actorId: actor.id,
          action: "booking.status_changed",
          entityType: "booking",
          entityId: id,
          summary: {
            from: booking.status,
            to,
            override: overrideReason ? true : undefined,
          },
        },
        tx,
      );
    },
    { timeout: 20_000 },
  );
  return { warnings };
}

/** The default cancellation policy from Settings, as it stands right now. */
async function snapshotCancellationPolicy(): Promise<Prisma.InputJsonValue | null> {
  const { defaultCancellationPolicyId } = await getSettings("bookingPolicy");
  if (!defaultCancellationPolicyId) return null;
  const policy = await db.cancellationPolicy.findFirst({
    where: { id: defaultCancellationPolicyId, active: true },
  });
  if (!policy) return null;
  return {
    id: policy.id,
    name: policy.name,
    description: policy.description,
    slabs: parseSlabs(policy.slabs),
    snapshotAt: new Date().toISOString(),
  } as Prisma.InputJsonValue;
}

/** Re-places expired holds of an enquiry-hold booking (fresh expiry from now). */
export async function renewHolds(actor: Actor, id: string) {
  assertPermission(actor, "holds.place");
  const booking = await requireBooking(actor, id);
  if (booking.status !== "ENQUIRY_HOLD")
    throw new RuleError("Only bookings on enquiry hold have holds to renew.");
  const subEvents = await db.bookingSubEvent.findMany({
    where: { bookingId: id },
    include: { reservation: true },
  });
  const now = new Date();
  await db.$transaction(async (tx) => {
    for (const subEvent of subEvents) {
      if (subEvent.reservation?.waitlistPosition) continue;
      // Re-placing gives a fresh expiry: clear the old one first.
      if (subEvent.reservation)
        await tx.slotReservation.update({
          where: { id: subEvent.reservation.id },
          data: { holdExpiresAt: null },
        });
      await syncReservation(tx, subEvent, "HOLD", { actorId: actor.id, now });
    }
    await recordActivity(
      {
        entityType: "booking",
        entityId: id,
        actorId: actor.id,
        kind: "HOLD",
        message: "Holds renewed",
      },
      tx,
    );
  });
}

// ─── Cancellation ────────────────────────────────────────────────────────────

export const cancelSchema = z.object({
  reason: requiredText("Reason", 500),
  agreedRefund: optionalMoneyString,
  overrideReason: optionalText(500),
});

/** Refund the snapshotted policy gives if the booking were cancelled today. */
export async function cancellationQuote(
  actor: Actor,
  id: string,
  today: string = todayIST(),
) {
  const booking = await requireBooking(actor, id);
  const [first, ledger] = await Promise.all([
    db.bookingSubEvent.findFirst({
      where: { bookingId: id },
      orderBy: { date: "asc" },
    }),
    db.ledgerEntry.findMany({
      where: { bookingId: id },
      select: { type: true, direction: true, amount: true },
    }),
  ]);
  const netReceived = ledgerTotals(ledger).netReceived;
  const snapshot = booking.cancellationPolicySnapshot as {
    name?: string;
    slabs?: unknown;
  } | null;
  const slabs = parseSlabs(snapshot?.slabs);
  const daysBefore = first ? daysBetween(today, dateKey(first.date)) : 0;
  const result = cancellationRefund(slabs, daysBefore, netReceived);
  return {
    policyName: snapshot?.name ?? null,
    slabs,
    daysBefore,
    netReceived,
    ...result,
    hasPolicy: slabs.length > 0,
  };
}

/**
 * Cancels a booking: computes the refund from the snapshotted slabs, allows
 * an authorised different amount with a reason, releases every slot (and
 * promotes waitlists). Refund payments and credit notes are then recorded
 * by Accounts from the booking's money tab.
 */
export async function cancelBooking(
  actor: Actor,
  id: string,
  input: z.infer<typeof cancelSchema>,
) {
  assertPermission(actor, "bookings.confirm");
  const booking = await requireBooking(actor, id);
  if (!canTransition(booking.status, "CANCELLED"))
    throw new RuleError("This booking can't be cancelled.");
  const quote = await cancellationQuote(actor, id);
  const computed = roundMoney(quote.refundAmount);
  const agreed = input.agreedRefund ? money(input.agreedRefund) : computed;
  const overridden = !agreed.equals(computed);
  if (overridden && !input.overrideReason)
    fieldError(
      "overrideReason",
      "Explain why the refund differs from the policy",
    );
  if (
    agreed.greaterThan(quote.netReceived.isNegative() ? 0 : quote.netReceived)
  )
    fieldError(
      "agreedRefund",
      "The refund can't be more than the amount received",
    );
  const subEvents = await db.bookingSubEvent.findMany({
    where: { bookingId: id },
    select: { id: true },
  });
  const now = new Date();
  await db.$transaction(async (tx) => {
    for (const s of subEvents)
      await releaseReservation(tx, s.id, "CANCELLED", now);
    await tx.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancellation: {
          reason: input.reason,
          cancelledOn: todayIST(now),
          daysBefore: quote.daysBefore,
          policy: quote.policyName,
          slabPercent: quote.refundPercent.toFixed(2),
          netReceived: quote.netReceived.toFixed(2),
          computedRefund: computed.toFixed(2),
          agreedRefund: agreed.toFixed(2),
          overridden,
          overrideReason: overridden ? input.overrideReason : null,
          actorId: actor.id,
        },
      },
    });
    await logStatus(
      tx,
      id,
      booking.status,
      "CANCELLED",
      actor.id,
      input.reason,
    );
    await recordActivity(
      {
        entityType: "booking",
        entityId: id,
        actorId: actor.id,
        kind: "CANCELLED",
        message: `Cancelled — ${input.reason}. Refund due ₹${agreed.toFixed(2)}${overridden ? " (differs from policy)" : ""}`,
      },
      tx,
    );
    await recordAudit(
      {
        actorId: actor.id,
        action: "booking.cancelled",
        entityType: "booking",
        entityId: id,
        summary: {
          computedRefund: computed.toFixed(2),
          agreedRefund: agreed.toFixed(2),
          overridden,
          overrideReason: overridden ? input.overrideReason : null,
        },
      },
      tx,
    );
  });
}

// ─── Deletion ────────────────────────────────────────────────────────────────

/**
 * Why a booking can't be deleted, or null when it can. Firm bookings must be
 * un-confirmed first. Money must be settled: every payment refunded or
 * reversed (net ₹0), the security deposit returned, and every invoice fully
 * credited. The money records themselves are never removed — deleting only
 * hides the booking — so the accounts and the GST trail stay complete.
 */
export async function bookingDeleteBlocker(
  id: string,
  status: BookingStatus,
): Promise<string | null> {
  if (
    status === "CONFIRMED" ||
    status === "IN_PROGRESS" ||
    status === "COMPLETED"
  ) {
    return "Booked or completed bookings can't be deleted. Cancel it first, then delete.";
  }
  const [ledger, deposits, openInvoices] = await Promise.all([
    db.ledgerEntry.findMany({
      where: { bookingId: id },
      select: { type: true, direction: true, amount: true },
    }),
    db.depositEntry.findMany({
      where: { bookingId: id },
      select: { type: true, amount: true },
    }),
    db.invoice.findMany({
      where: { bookingId: id, status: { not: "FULLY_CREDITED" } },
      select: { number: true },
    }),
  ]);
  const problems: string[] = [];
  const net = ledgerTotals(ledger).netReceived;
  if (!net.isZero()) {
    problems.push(
      net.isPositive()
        ? `${formatINR(net)} received from the customer is still on record — record a refund for it on the Payments tab`
        : `the payments show ${formatINR(net.abs())} more refunded than received — fix it with an adjustment on the Payments tab`,
    );
  }
  const held = depositTotals(deposits).held;
  if (!held.isZero())
    problems.push(
      `the security deposit of ${formatINR(held)} is still held — return it on the Payments tab`,
    );
  if (openInvoices.length)
    problems.push(
      `invoice ${openInvoices.map((i) => i.number).join(", ")} must be fully credited with a credit note`,
    );
  if (!problems.length) return null;
  return `Settle the money before deleting: ${problems.join("; ")}. Payment records are kept for the accounts; once the balance is ₹0 the booking can be deleted.`;
}

/**
 * Deletes a booking entered by mistake or no longer needed: hidden everywhere
 * (soft delete), its halls are freed and its open tasks are cancelled. The
 * record and its history stay in the database for the audit log.
 */
export async function deleteBooking(actor: Actor, id: string, reason: string) {
  assertPermission(actor, "bookings.delete");
  if (!reason.trim()) fieldError("reason", "Say why (e.g. entered by mistake)");
  const booking = await requireBooking(actor, id);
  const blocker = await bookingDeleteBlocker(id, booking.status);
  if (blocker) throw new RuleError(blocker);
  await db.$transaction(
    (tx) => softDeleteBooking(tx, booking, actor.id, reason),
    { timeout: 20_000 },
  );
}

/** Frees the halls, cancels open tasks and hides the booking. Callers check `bookingDeleteBlocker` first. */
export async function softDeleteBooking(
  tx: Tx,
  booking: { id: string; reference: string; status: BookingStatus },
  actorId: string,
  reason: string,
) {
  const now = new Date();
  const subEvents = await tx.bookingSubEvent.findMany({
    where: { bookingId: booking.id },
    select: { id: true },
  });
  for (const s of subEvents)
    await releaseReservation(tx, s.id, "RELEASED", now);
  await tx.task.updateMany({
    where: { bookingId: booking.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
    data: { status: "CANCELLED" },
  });
  await tx.booking.update({
    where: { id: booking.id },
    data: { deletedAt: now },
  });
  await recordActivity(
    {
      entityType: "booking",
      entityId: booking.id,
      actorId,
      kind: "DELETED",
      message: `Deleted: ${reason.slice(0, 200)}`,
    },
    tx,
  );
  await recordAudit(
    {
      actorId,
      action: "booking.deleted",
      entityType: "booking",
      entityId: booking.id,
      summary: {
        reference: booking.reference,
        status: booking.status,
        reason: reason.slice(0, 200),
      },
    },
    tx,
  );
}

// ─── Menus and plates ────────────────────────────────────────────────────────

export const menuSelectionSchema = z.object({
  menuPackageId: requiredText("Menu package", 50),
  itemIds: z.array(z.string().max(50)).max(200).default([]),
  /** Dishes the customer asked for that are not in the catalog menu. Price stays per plate. */
  extraDishes: z
    .array(
      z.object({
        course: z.enum(MENU_COURSES),
        name: z.string().trim().min(1).max(120),
      }),
    )
    .max(100)
    .default([]),
  guaranteedPlates: positiveInt("the guaranteed plates"),
});

export type MenuSnapshot = {
  menuName: string;
  category: string;
  packageName: string;
  perPlateRate: string;
  minPlates: number | null;
  /** Only on menus chosen before GST was removed (26 Oct 2026); unused. */
  taxCategoryId?: string | null;
  sacCode?: string | null;
  taxRatePercent?: string | null;
  /** `extra`: typed in for this booking, not from the catalog menu. */
  items: { course: string; name: string; extra?: true }[];
};

export async function setMenuSelection(
  actor: Actor,
  subEventId: string,
  input: z.infer<typeof menuSelectionSchema>,
) {
  const subEvent = await db.bookingSubEvent.findUnique({
    where: { id: subEventId },
    include: { menuSelection: true },
  });
  if (!subEvent) throw new NotFoundError("Function");
  const booking = await requireBooking(actor, subEvent.bookingId);
  assertCanEdit(actor, booking.status);
  const pkg = await db.menuPackage.findFirst({
    where: { id: input.menuPackageId, active: true },
    include: { menu: { include: { items: true } } },
  });
  if (!pkg) fieldError("menuPackageId", "Choose an active menu package");
  const { guestCountLockDays } = await getSettings("bookingPolicy");
  const locked = isGuestCountLocked(
    todayIST(),
    dateKey(subEvent.date),
    guestCountLockDays,
  );
  const platesChanged =
    subEvent.menuSelection &&
    subEvent.menuSelection.guaranteedPlates !== input.guaranteedPlates;
  if (locked && platesChanged && !can(actor, "plates.change_after_lock")) {
    throw new ForbiddenError("plates.change_after_lock");
  }
  if (pkg.minPlates && input.guaranteedPlates < pkg.minPlates)
    fieldError(
      "guaranteedPlates",
      `This menu needs at least ${pkg.minPlates} guaranteed plates`,
    );
  const rules = parseSelectionRules(pkg.selectionRules);
  const chosen = pkg.menu.items.filter((item) =>
    input.itemIds.includes(item.id),
  );
  if (chosen.length !== new Set(input.itemIds).size)
    fieldError("itemIds", "Some items aren't on this menu");
  for (const rule of rules) {
    const count = chosen.filter((i) => i.course === rule.course).length;
    if (count > rule.choose)
      fieldError(
        "itemIds",
        `Choose at most ${rule.choose} item(s) from ${rule.course.replace("_", " ")}`,
      );
  }
  // Courses without a rule are served in full.
  const ruled = new Set<string>(rules.map((r) => r.course));
  const items = pkg.menu.items
    .filter((i) => (ruled.has(i.course) ? input.itemIds.includes(i.id) : true))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i): MenuSnapshot["items"][number] => ({
      course: i.course,
      name: t(i.name, "en"),
    }));
  const known = new Set(
    items.map((i) => `${i.course}|${i.name.toLowerCase()}`),
  );
  for (const dish of input.extraDishes) {
    const key = `${dish.course}|${dish.name.toLowerCase()}`;
    if (known.has(key)) continue;
    known.add(key);
    items.push({ course: dish.course, name: dish.name, extra: true });
  }
  const snapshot: MenuSnapshot = {
    menuName: t(pkg.menu.name, "en"),
    category: pkg.menu.category,
    packageName: pkg.name,
    perPlateRate: pkg.perPlateRate.toFixed(2),
    minPlates: pkg.minPlates,
    items,
  };
  await db.$transaction(async (tx) => {
    await tx.subEventMenuSelection.upsert({
      where: { subEventId },
      update: {
        menuPackageId: pkg.id,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        guaranteedPlates: input.guaranteedPlates,
      },
      create: {
        subEventId,
        menuPackageId: pkg.id,
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        guaranteedPlates: input.guaranteedPlates,
      },
    });
    await recordActivity(
      {
        entityType: "booking",
        entityId: booking.id,
        actorId: actor.id,
        kind: "MENU",
        message: `${subEvent.name}: ${pkg.name}, ${input.guaranteedPlates} guaranteed plates${items.some((i) => i.extra) ? `, ${items.filter((i) => i.extra).length} extra dish(es)` : ""}`,
      },
      tx,
    );
    if (locked && platesChanged) {
      await recordAudit(
        {
          actorId: actor.id,
          action: "plates.changed_after_lock",
          entityType: "booking",
          entityId: booking.id,
          summary: {
            subEvent: subEvent.name,
            from: subEvent.menuSelection!.guaranteedPlates,
            to: input.guaranteedPlates,
          },
        },
        tx,
      );
    }
  });
}

export async function recordActualPlates(
  actor: Actor,
  subEventId: string,
  actualPlates: number,
) {
  const subEvent = await db.bookingSubEvent.findUnique({
    where: { id: subEventId },
    include: {
      menuSelection: true,
      postEventCharges: { where: { kind: "EXTRA_PLATES" } },
    },
  });
  if (!subEvent?.menuSelection)
    throw new RuleError("Choose the menu for this function first.");
  const booking = await requireBooking(actor, subEvent.bookingId);
  assertPermission(actor, "bookings.edit");
  if (!isFirm(booking.status))
    throw new RuleError("Actual plates are recorded for confirmed bookings.");
  if (subEvent.startsAt > new Date())
    throw new RuleError("Record actual plates once the function has started.");
  if (subEvent.postEventCharges.length)
    throw new RuleError(
      "Extra plates have already been billed for this function.",
    );
  if (
    !Number.isInteger(actualPlates) ||
    actualPlates < 0 ||
    actualPlates > 100_000
  )
    fieldError("actualPlates", "Enter the number of plates served");
  await db.$transaction(async (tx) => {
    await tx.subEventMenuSelection.update({
      where: { id: subEvent.menuSelection!.id },
      data: {
        actualPlates,
        actualRecordedAt: new Date(),
        actualRecordedById: actor.id,
      },
    });
    await recordActivity(
      {
        entityType: "booking",
        entityId: booking.id,
        actorId: actor.id,
        kind: "PLATES",
        message: `${subEvent.name}: ${actualPlates} plates served (guaranteed ${subEvent.menuSelection!.guaranteedPlates})`,
      },
      tx,
    );
  });
}

// ─── Bride and groom ─────────────────────────────────────────────────────────

export const partySchema = z.object({
  role: z.enum(["BRIDE", "GROOM"]),
  fullName: requiredText("Full name", 120),
  mobile: optionalPhone,
  email: optionalEmail,
  altPhone: optionalPhone,
  notes: optionalText(1000),
});

export async function saveParty(
  actor: Actor,
  bookingId: string,
  input: z.infer<typeof partySchema>,
) {
  const booking = await requireBooking(actor, bookingId);
  assertCanEdit(actor, booking.status);
  assertPermission(actor, "customers.edit");
  const { role, ...data } = input;
  await db.$transaction(async (tx) => {
    await tx.brideGroomParty.upsert({
      where: { bookingId_role: { bookingId, role } },
      update: data,
      create: { bookingId, role, ...data },
    });
    await recordActivity(
      {
        entityType: "booking",
        entityId: bookingId,
        actorId: actor.id,
        kind: "PARTY",
        message: `${role === "BRIDE" ? "Bride" : "Groom"} details saved`,
      },
      tx,
    );
  });
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export async function calendarEntries(actor: Actor, from: string, to: string) {
  await releaseExpiredHolds();
  const visible = bookingVisibility(actor);
  const rows = await db.bookingSubEvent.findMany({
    where: {
      date: { gte: dateFromKey(from), lte: dateFromKey(to) },
      booking: { AND: [visible, { status: { not: "CANCELLED" } }] },
    },
    orderBy: [{ startsAt: "asc" }],
    select: {
      id: true,
      name: true,
      date: true,
      startsAt: true,
      endsAt: true,
      expectedGuests: true,
      hall: { select: { id: true, name: true } },
      reservation: {
        select: { state: true, waitlistPosition: true, holdExpiresAt: true },
      },
      booking: {
        select: {
          id: true,
          reference: true,
          status: true,
          mainEventName: true,
          customer: { select: { fullName: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    ...r,
    booking: {
      ...r.booking,
      customer: can(actor, "customers.read") ? r.booking.customer : null,
    },
  }));
}

/** Bookings whose event dates (from – to) overlap the range, for the calendar. */
export async function calendarBookings(actor: Actor, from: string, to: string) {
  const rows = await db.booking.findMany({
    where: {
      AND: [
        bookingVisibility(actor),
        { status: { not: "CANCELLED" } },
        { startDate: { lte: dateFromKey(to) } },
        { OR: [{ endDate: { gte: dateFromKey(from) } }, { endDate: null, startDate: { gte: dateFromKey(from) } }] },
      ],
    },
    orderBy: { startDate: "asc" },
    select: { id: true, reference: true, status: true, mainEventName: true, startDate: true, endDate: true },
  });
  return rows.map((b) => ({ ...b, from: dateKey(b.startDate!), to: dateKey(b.endDate ?? b.startDate!) }));
}

// ─── Detail ──────────────────────────────────────────────────────────────────

export async function getBookingDetail(actor: Actor, id: string) {
  await releaseExpiredHolds();
  const booking = await db.booking.findFirst({
    where: { AND: [{ id }, bookingVisibility(actor)] },
    include: {
      customer: true,
      lead: { select: { id: true, reference: true } },
      owner: { select: { id: true, name: true } },
      subEvents: {
        orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
        include: {
          hall: {
            select: {
              id: true,
              name: true,
              setupBufferMinutes: true,
              teardownBufferMinutes: true,
            },
          },
          assignedTo: { select: { id: true, name: true } },
          reservation: true,
          menuSelection: true,
        },
      },
      parties: true,
      statusHistory: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!booking) throw new NotFoundError("Booking");
  const customer = can(actor, "customers.read")
    ? {
        id: booking.customer.id,
        reference: booking.customer.reference,
        fullName: booking.customer.fullName,
        mobile: booking.customer.mobile,
        email: booking.customer.email,
        gstin: booking.customer.gstin,
        city: booking.customer.city,
        stateCode: booking.customer.stateCode,
      }
    : null;
  return {
    ...booking,
    customer,
    parties: can(actor, "customers.read") ? booking.parties : [],
  };
}
