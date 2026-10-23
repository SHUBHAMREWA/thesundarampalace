"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  convertLeadToCustomer,
  createCustomer,
  CONSENT_PURPOSES,
  customerSchema,
  deleteCustomerDocument,
  dismissMergeReview,
  documentUploadSchema,
  DuplicateCustomerError,
  flagPossibleDuplicate,
  mergeCustomers,
  setCustomerConsent,
  updateCustomer,
  uploadCustomerDocument,
  type ConsentPurpose,
} from "@/server/services/customers";
import { fieldError } from "@/server/services/errors";

import { checkbox, currentActor, formObject, runAction, text, type ActionState } from "./helpers";

function refresh(id?: string) {
  revalidatePath("/admin/customers");
  if (id) revalidatePath(`/admin/customers/${id}`);
}

export async function createCustomerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let duplicate: DuplicateCustomerError | null = null;
  const result = await runAction(async () => {
    const input = customerSchema.parse(formObject(form));
    try {
      const customer = await createCustomer(await currentActor(), input, {
        allowDuplicate: checkbox(form, "allowDuplicate"),
        leadId: text(form, "leadId") || undefined,
      });
      refresh();
      const next = text(form, "next");
      return {
        message: `Customer ${customer.reference} created.`,
        redirectTo: next === "booking" ? `/admin/bookings/new?customerId=${customer.id}` : `/admin/customers/${customer.id}`,
      };
    } catch (error) {
      if (error instanceof DuplicateCustomerError) duplicate = error;
      throw error;
    }
  });
  if (duplicate) {
    const d = duplicate as DuplicateCustomerError;
    return { ...result, fieldErrors: { mobile: d.message }, data: { existingId: d.existing.id, existingName: d.existing.fullName, existingReference: d.existing.reference } };
  }
  return result;
}

export async function updateCustomerAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateCustomer(await currentActor(), id, customerSchema.parse(formObject(form)));
    refresh(id);
    return { message: "Customer saved." };
  });
}

export async function setConsentAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const purpose = text(form, "purpose") ?? "";
    if (!CONSENT_PURPOSES.some((p) => p.value === purpose)) fieldError("purpose", "Unknown purpose");
    const granted = text(form, "granted") === "true";
    await setCustomerConsent(await currentActor(), id, purpose as ConsentPurpose, granted, "crm:staff_recorded");
    refresh(id);
    return { message: granted ? "Opt-in recorded." : "Opt-out recorded." };
  });
}

export async function uploadDocumentAction(customerId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = documentUploadSchema.parse(formObject(form));
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) fieldError("file", "Choose a file");
    const bytes = new Uint8Array(await file.arrayBuffer());
    await uploadCustomerDocument(await currentActor(), customerId, input, { name: file.name, bytes });
    refresh(customerId);
    return { message: "Document stored privately." };
  });
}

export async function deleteDocumentAction(customerId: string, documentId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await deleteCustomerDocument(await currentActor(), documentId, text(form, "reason") ?? "");
    refresh(customerId);
    return { message: "Document deleted." };
  });
}

export async function mergeCustomersAction(reviewId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const keepId = text(form, "keepId");
    if (!keepId) fieldError("keepId", "Choose which record to keep");
    const result = await mergeCustomers(await currentActor(), reviewId, keepId);
    refresh(result.keptId);
    revalidatePath("/admin/customers/duplicates");
    return { message: "Customers merged." };
  });
}

export async function dismissMergeAction(reviewId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await dismissMergeReview(await currentActor(), reviewId, text(form, "note") || null);
    revalidatePath("/admin/customers/duplicates");
    return { message: "Marked as not a duplicate." };
  });
}

export async function flagDuplicateAction(customerId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const otherReference = (text(form, "otherId") ?? "").trim();
    if (!otherReference) fieldError("otherId", "Enter the other customer's reference");
    const other = await db.customer.findFirst({ where: { reference: otherReference.toUpperCase(), deletedAt: null }, select: { id: true } });
    if (!other) fieldError("otherId", "No customer has that reference");
    await flagPossibleDuplicate(await currentActor(), customerId, other.id);
    revalidatePath("/admin/customers/duplicates");
    return { message: "Sent for duplicate review." };
  });
}

export async function convertLeadAction(leadId: string, _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const result = await convertLeadToCustomer(await currentActor(), leadId);
    revalidatePath(`/admin/leads/${leadId}`);
    refresh(result.customerId);
    return {
      message: result.created ? "Customer created from this lead." : "Linked to the existing customer with this mobile number.",
      redirectTo: `/admin/customers/${result.customerId}`,
    };
  });
}
