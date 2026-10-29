"use server";

import { revalidatePath } from "next/cache";

import {
  adjustmentSchema,
  billExtraPlates,
  chargeSchema,
  creditNoteSchema,
  invoiceSchema,
  issueCreditNote,
  issueInvoice,
  paymentSchema,
  recordAdjustment,
  recordCharge,
  recordPayment,
  recordRefund,
  refundSchema,
} from "@/server/services/money";

import {
  currentActor,
  formObject,
  runAction,
  text,
  type ActionState,
} from "./helpers";

function refresh(bookingId: string) {
  revalidatePath(`/admin/bookings/${bookingId}`);
}

const DUPLICATE = "This was already recorded (the form was submitted twice).";

function done(result: unknown, message: string): Partial<ActionState> {
  return result && typeof result === "object" && "duplicate" in result
    ? { message: DUPLICATE }
    : { message };
}

export async function recordPaymentAction(
  bookingId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const result = await recordPayment(
      await currentActor(),
      bookingId,
      paymentSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return done(result, "Payment recorded and receipt number issued.");
  });
}

export async function recordRefundAction(
  bookingId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const result = await recordRefund(
      await currentActor(),
      bookingId,
      refundSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return done(result, "Refund recorded.");
  });
}

export async function recordAdjustmentAction(
  bookingId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const result = await recordAdjustment(
      await currentActor(),
      bookingId,
      adjustmentSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return done(result, "Adjustment recorded.");
  });
}

export async function recordChargeAction(
  bookingId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const result = await recordCharge(
      await currentActor(),
      bookingId,
      chargeSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return done(result, "Charge recorded.");
  });
}

export async function billExtraPlatesAction(
  bookingId: string,
  subEventId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const result = await billExtraPlates(
      await currentActor(),
      subEventId,
      text(form, "idempotencyKey") ?? "",
    );
    refresh(bookingId);
    return done(result, "Extra plates added as a post-event charge.");
  });
}

export async function issueInvoiceAction(
  bookingId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const result = await issueInvoice(
      await currentActor(),
      bookingId,
      invoiceSchema.parse(formObject(form)),
    );
    refresh(bookingId);
    return done(result, "Invoice issued.");
  });
}

export async function issueCreditNoteAction(
  bookingId: string,
  invoiceId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const values = formObject(form);
    const lines: Record<string, string> = {};
    for (const [key, value] of Object.entries(values))
      if (key.startsWith("lines.") && value.trim())
        lines[key.slice(6)] = value.trim();
    const result = await issueCreditNote(
      await currentActor(),
      invoiceId,
      creditNoteSchema.parse({ ...values, lines }),
    );
    refresh(bookingId);
    return done(result, "Credit note issued.");
  });
}
