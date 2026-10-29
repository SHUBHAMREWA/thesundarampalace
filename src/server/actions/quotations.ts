"use server";

import { revalidatePath } from "next/cache";

import {
  addLine,
  createDraft,
  draftOptionsSchema,
  lineSchema,
  moveLine,
  removeLine,
  updateDraftOptions,
  updateLine,
} from "@/server/services/quotations";

import {
  currentActor,
  formObject,
  runAction,
  type ActionState,
} from "./helpers";

function refresh(bookingId: string) {
  revalidatePath(`/admin/bookings/${bookingId}`);
}

export async function createDraftAction(
  bookingId: string,
  _prev: ActionState,
  _form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await createDraft(await currentActor(), bookingId, null);
    refresh(bookingId);
    return { message: "Quotation started. Add its items below." };
  });
}

export async function updateDraftOptionsAction(
  bookingId: string,
  versionId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await updateDraftOptions(
      await currentActor(),
      versionId,
      draftOptionsSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return { message: "Quotation options saved." };
  });
}

export async function addLineAction(
  bookingId: string,
  versionId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await addLine(
      await currentActor(),
      versionId,
      lineSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return { message: "Line added." };
  });
}

export async function updateLineAction(
  bookingId: string,
  lineId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await updateLine(
      await currentActor(),
      lineId,
      lineSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return { message: "Line saved." };
  });
}

export async function removeLineAction(
  bookingId: string,
  lineId: string,
  _prev: ActionState,
  _form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await removeLine(await currentActor(), lineId);
    refresh(bookingId);
    return { message: "Line removed." };
  });
}

export async function moveLineAction(
  bookingId: string,
  lineId: string,
  direction: "up" | "down",
  _prev: ActionState,
  _form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await moveLine(await currentActor(), lineId, direction);
    refresh(bookingId);
  });
}
