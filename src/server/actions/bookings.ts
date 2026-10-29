"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { formatIST, todayIST } from "@/lib/time";
import { can } from "@/server/policies/authorize";
import { paymentSchema, recordPayment } from "@/server/services/money";
import {
  addSubEvent,
  bookingDetailsSchema,
  cancelBooking,
  deleteBooking,
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
import {
  deleteCustomerDocument,
  documentUploadSchema,
  uploadCustomerDocument,
} from "@/server/services/customers";
import { fieldError } from "@/server/services/errors";
import {
  describeConflict,
  SlotConflictError,
} from "@/server/services/reservations";

import {
  currentActor,
  formObject,
  runAction,
  text,
  type ActionState,
} from "./helpers";

export async function deleteBookingAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await deleteBooking(await currentActor(), id, text(form, "reason") ?? "");
    refresh();
    revalidatePath("/admin");
    return { message: "Booking deleted.", redirectTo: "/admin/bookings" };
  });
}

function refresh(id?: string) {
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/calendar");
  if (id) revalidatePath(`/admin/bookings/${id}`);
}

/** Conflicts become a form error the user can act on (override field shown). */
async function withConflicts(
  fn: () => Promise<Partial<ActionState> | void>,
): Promise<ActionState> {
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

export async function createBookingAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await currentActor();
    const input = createBookingSchema.parse(formObject(form));
    if (!input.bookingAmount)
      fieldError("bookingAmount", "Enter the booking amount");
    const advance =
      input.advanceAmount && Number(input.advanceAmount) > 0
        ? input.advanceAmount
        : null;
    // Check the advance before the booking exists, so a bad advance never leaves a half-made booking.
    const payment = advance
      ? paymentSchema.parse({
          idempotencyKey: text(form, "idempotencyKey"),
          amount: advance,
          occurredOn: todayIST(),
          method: input.advanceMethod ?? "",
          notes: "Advance taken at booking",
        })
      : null;
    if (payment && !can(actor, "payments.create"))
      fieldError(
        "advanceAmount",
        "You can't record payments; leave the advance empty",
      );
    const booking = await createBooking(actor, input);
    if (payment) await recordPayment(actor, booking.id, payment);
    refresh(booking.id);
    return {
      message: payment
        ? `Booking ${booking.reference} created and the ${formatINR(payment.amount)} advance recorded. Add its functions next.`
        : `Booking ${booking.reference} created. Add its functions next.`,
      redirectTo: `/admin/bookings/${booking.id}`,
    };
  });
}

export async function updateBookingAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await updateBookingDetails(
      await currentActor(),
      id,
      bookingDetailsSchema.parse(formObject(form)),
    );
    refresh(id);
    return { message: "Booking saved." };
  });
}

export async function addSubEventAction(
  bookingId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withConflicts(async () => {
    const result = await addSubEvent(
      await currentActor(),
      bookingId,
      subEventSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return {
      message: result.waitlistPosition
        ? `Added — the slot is taken, so this hold is waitlist #${result.waitlistPosition}.`
        : "Function added.",
      warnings: result.warnings.map(describeConflict),
    };
  });
}

export async function updateSubEventAction(
  bookingId: string,
  subEventId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withConflicts(async () => {
    const result = await updateSubEvent(
      await currentActor(),
      subEventId,
      subEventSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return {
      message: "Function saved.",
      warnings: result.warnings.map(describeConflict),
    };
  });
}

export async function checkAvailabilityAction(
  bookingId: string | null,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { range, conflicts } = await checkAvailability(
      await currentActor(),
      bookingId,
      subEventSchema.parse(formObject(form)),
    );
    const when = `${formatIST(range.startsAt, "d MMM h:mm a")} – ${formatIST(range.endsAt, "d MMM h:mm a")}`;
    if (!conflicts.length)
      return { message: `Available: ${when}.`, data: { available: true } };
    return {
      message: conflicts.some((c) => c.blocking)
        ? `Not available (${when}).`
        : `Available with warnings (${when}).`,
      warnings: conflicts.map(
        (c) => `${c.blocking ? "Blocking" : "Warning"}: ${describeConflict(c)}`,
      ),
      data: { available: !conflicts.some((c) => c.blocking) },
    };
  });
}

export async function removeSubEventAction(
  bookingId: string,
  subEventId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await removeSubEvent(
      await currentActor(),
      subEventId,
      text(form, "reason") || null,
    );
    refresh(bookingId);
    return { message: "Function removed." };
  });
}

export async function moveSubEventAction(
  bookingId: string,
  subEventId: string,
  direction: "up" | "down",
  _prev: ActionState,
  _form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await moveSubEvent(await currentActor(), subEventId, direction);
    refresh(bookingId);
  });
}

export async function changeStatusAction(
  bookingId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return withConflicts(async () => {
    const result = await changeBookingStatus(
      await currentActor(),
      bookingId,
      statusChangeSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return { message: "Status updated.", warnings: result.warnings };
  });
}

export async function renewHoldsAction(
  bookingId: string,
  _prev: ActionState,
  _form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await renewHolds(await currentActor(), bookingId);
    refresh(bookingId);
    return { message: "Holds renewed." };
  });
}

export async function cancelBookingAction(
  bookingId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await cancelBooking(
      await currentActor(),
      bookingId,
      cancelSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return { message: "Booking cancelled and its slots released." };
  });
}

export async function setMenuAction(
  bookingId: string,
  subEventId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    // "extraDishes.<course>" fields hold comma- or line-separated dish names.
    const extraDishes = [...form.entries()]
      .filter(([key]) => key.startsWith("extraDishes."))
      .flatMap(([key, value]) =>
        String(value)
          .split(/[,\n]/)
          .map((name) => ({
            course: key.slice("extraDishes.".length),
            name: name.trim(),
          })),
      )
      .filter((d) => d.name);
    const input = menuSelectionSchema.parse({
      ...formObject(form),
      itemIds: form.getAll("itemIds").map(String),
      extraDishes,
    });
    await setMenuSelection(await currentActor(), subEventId, input);
    refresh(bookingId);
    return { message: "Menu saved." };
  });
}

export async function recordPlatesAction(
  bookingId: string,
  subEventId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actual = z.coerce
      .number()
      .int()
      .min(0)
      .max(100_000)
      .parse(text(form, "actualPlates"));
    await recordActualPlates(await currentActor(), subEventId, actual);
    refresh(bookingId);
    return { message: "Plates served recorded." };
  });
}

export async function uploadPartyDocumentAction(
  bookingId: string,
  partyId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await currentActor();
    const party = await db.brideGroomParty.findFirst({
      where: { id: partyId, bookingId },
      select: { booking: { select: { customerId: true } } },
    });
    if (!party?.booking.customerId)
      fieldError("file", "Save the name first, then add documents");
    const input = documentUploadSchema.parse({ ...formObject(form), partyId });
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      fieldError("file", "Choose a photo or PDF of the document");
    await uploadCustomerDocument(actor, party.booking.customerId, input, {
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
    refresh(bookingId);
    revalidatePath(`/admin/customers/${party.booking.customerId}`);
    return { message: "Document saved privately." };
  });
}

export async function deletePartyDocumentAction(
  bookingId: string,
  documentId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await deleteCustomerDocument(
      await currentActor(),
      documentId,
      text(form, "reason") ?? "",
    );
    refresh(bookingId);
    return { message: "Document deleted." };
  });
}

export async function savePartyAction(
  bookingId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await saveParty(
      await currentActor(),
      bookingId,
      partySchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return { message: "Saved." };
  });
}
