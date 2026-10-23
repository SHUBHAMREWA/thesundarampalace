"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formatIST } from "@/lib/time";
import {
  addSubEvent,
  bookingDetailsSchema,
  cancelBooking,
  cancelSchema,
  changeBookingStatus,
  checkAvailability,
  createBooking,
  createBookingSchema,
  menuSelectionSchema,
  moveSubEvent,
  partySchema,
  recordActualPlates,
  removeSubEvent,
  renewHolds,
  saveParty,
  setMenuSelection,
  statusChangeSchema,
  subEventSchema,
  updateBookingDetails,
  updateSubEvent,
} from "@/server/services/bookings";
import { describeConflict, SlotConflictError } from "@/server/services/reservations";

import { currentActor, formObject, runAction, text, type ActionState } from "./helpers";

function refresh(id?: string) {
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/calendar");
  if (id) revalidatePath(`/admin/bookings/${id}`);
}

/** Conflicts become a form error the user can act on (override field shown). */
async function withConflicts(fn: () => Promise<Partial<ActionState> | void>): Promise<ActionState> {
  let conflict: SlotConflictError | null = null;
  const result = await runAction(async () => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof SlotConflictError) conflict = error;
      throw error;
    }
  });
  if (conflict) return { ...result, data: { conflict: true } };
  return result;
}

export async function createBookingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const booking = await createBooking(await currentActor(), createBookingSchema.parse(formObject(form)));
    refresh(booking.id);
    return { message: `Booking ${booking.reference} created. Add its functions next.`, redirectTo: `/admin/bookings/${booking.id}` };
  });
}

export async function updateBookingAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateBookingDetails(await currentActor(), id, bookingDetailsSchema.parse(formObject(form)));
    refresh(id);
    return { message: "Booking saved." };
  });
}

export async function addSubEventAction(bookingId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return withConflicts(async () => {
    const result = await addSubEvent(await currentActor(), bookingId, subEventSchema.parse(formObject(form)));
    refresh(bookingId);
    return {
      message: result.waitlistPosition ? `Added — the slot is taken, so this hold is waitlist #${result.waitlistPosition}.` : "Function added.",
      warnings: result.warnings.map(describeConflict),
    };
  });
}

export async function updateSubEventAction(bookingId: string, subEventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return withConflicts(async () => {
    const result = await updateSubEvent(await currentActor(), subEventId, subEventSchema.parse(formObject(form)));
    refresh(bookingId);
    return { message: "Function saved.", warnings: result.warnings.map(describeConflict) };
  });
}

export async function checkAvailabilityAction(bookingId: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { range, conflicts } = await checkAvailability(await currentActor(), bookingId, subEventSchema.parse(formObject(form)));
    const when = `${formatIST(range.startsAt, "d MMM h:mm a")} – ${formatIST(range.endsAt, "d MMM h:mm a")}`;
    if (!conflicts.length) return { message: `Available: ${when}.`, data: { available: true } };
    return {
      message: conflicts.some((c) => c.blocking) ? `Not available (${when}).` : `Available with warnings (${when}).`,
      warnings: conflicts.map((c) => `${c.blocking ? "Blocking" : "Warning"}: ${describeConflict(c)}`),
      data: { available: !conflicts.some((c) => c.blocking) },
    };
  });
}

export async function removeSubEventAction(bookingId: string, subEventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await removeSubEvent(await currentActor(), subEventId, text(form, "reason") || null);
    refresh(bookingId);
    return { message: "Function removed." };
  });
}

export async function moveSubEventAction(bookingId: string, subEventId: string, direction: "up" | "down", _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await moveSubEvent(await currentActor(), subEventId, direction);
    refresh(bookingId);
  });
}

export async function changeStatusAction(bookingId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return withConflicts(async () => {
    const result = await changeBookingStatus(await currentActor(), bookingId, statusChangeSchema.parse(formObject(form)));
    refresh(bookingId);
    return { message: "Status updated.", warnings: result.warnings };
  });
}

export async function renewHoldsAction(bookingId: string, _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await renewHolds(await currentActor(), bookingId);
    refresh(bookingId);
    return { message: "Holds renewed." };
  });
}

export async function cancelBookingAction(bookingId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await cancelBooking(await currentActor(), bookingId, cancelSchema.parse(formObject(form)));
    refresh(bookingId);
    return { message: "Booking cancelled and its slots released." };
  });
}

export async function setMenuAction(bookingId: string, subEventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = menuSelectionSchema.parse({ ...formObject(form), itemIds: form.getAll("itemIds").map(String) });
    await setMenuSelection(await currentActor(), subEventId, input);
    refresh(bookingId);
    return { message: "Menu saved." };
  });
}

export async function recordPlatesAction(bookingId: string, subEventId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const actual = z.coerce.number().int().min(0).max(100_000).parse(text(form, "actualPlates"));
    await recordActualPlates(await currentActor(), subEventId, actual);
    refresh(bookingId);
    return { message: "Plates served recorded." };
  });
}

export async function savePartyAction(bookingId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await saveParty(await currentActor(), bookingId, partySchema.parse(formObject(form)));
    refresh(bookingId);
    return { message: "Saved." };
  });
}
