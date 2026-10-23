"use server";

import { revalidatePath } from "next/cache";

import {
  acceptVersion,
  addLine,
  createDraft,
  deleteDraft,
  draftOptionsSchema,
  fillFromBooking,
  lineSchema,
  markSent,
  moveLine,
  removeLine,
  updateDraftOptions,
  updateLine,
} from "@/server/services/quotations";

import { currentActor, formObject, runAction, text, type ActionState } from "./helpers";

function refresh(bookingId: string) {
  revalidatePath(`/admin/bookings/${bookingId}`);
}

export async function createDraftAction(bookingId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const draft = await createDraft(await currentActor(), bookingId, text(form, "copyFrom") || null);
    refresh(bookingId);
    return { message: `Draft v${draft.versionNumber} ready.`, redirectTo: `/admin/bookings/${bookingId}?tab=quotations&v=${draft.id}` };
  });
}

export async function updateDraftOptionsAction(bookingId: string, versionId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateDraftOptions(await currentActor(), versionId, draftOptionsSchema.parse(formObject(form)));
    refresh(bookingId);
    return { message: "Quotation options saved." };
  });
}

export async function addLineAction(bookingId: string, versionId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addLine(await currentActor(), versionId, lineSchema.parse(formObject(form)));
    refresh(bookingId);
    return { message: "Line added." };
  });
}

export async function updateLineAction(bookingId: string, lineId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateLine(await currentActor(), lineId, lineSchema.parse(formObject(form)));
    refresh(bookingId);
    return { message: "Line saved." };
  });
}

export async function removeLineAction(bookingId: string, lineId: string, _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await removeLine(await currentActor(), lineId);
    refresh(bookingId);
    return { message: "Line removed." };
  });
}

export async function moveLineAction(bookingId: string, lineId: string, direction: "up" | "down", _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await moveLine(await currentActor(), lineId, direction);
    refresh(bookingId);
  });
}

export async function fillFromBookingAction(bookingId: string, versionId: string, _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const result = await fillFromBooking(await currentActor(), versionId);
    refresh(bookingId);
    return {
      message: result.added ? `${result.added} line(s) added from the booking's menus and package.` : "Nothing new to add from the booking.",
      warnings: result.missing,
    };
  });
}

export async function markSentAction(bookingId: string, versionId: string, _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await markSent(await currentActor(), versionId);
    refresh(bookingId);
    return { message: "Marked as sent. This version can no longer change." };
  });
}

export async function acceptVersionAction(bookingId: string, versionId: string, _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await acceptVersion(await currentActor(), versionId);
    refresh(bookingId);
    return { message: "Recorded as accepted. The booking's price now follows this version." };
  });
}

export async function deleteDraftAction(bookingId: string, versionId: string, _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await deleteDraft(await currentActor(), versionId);
    refresh(bookingId);
    return { message: "Draft discarded.", redirectTo: `/admin/bookings/${bookingId}?tab=quotations` };
  });
}
