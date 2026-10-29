"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/server/auth/session";
import { UnauthenticatedError } from "@/server/policies/authorize";
import {
  activitySchema,
  addLeadActivity,
  archiveLead,
  assignLead,
  changeLeadStatus,
  createLead,
  leadDetailsSchema,
  newLeadSchema,
  statusChangeSchema,
  updateLeadDetails,
} from "@/server/services/leads";

import { runAction, text, type ActionState } from "./helpers";

async function actor() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

function refresh(id: string) {
  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin/leads");
}

export async function changeLeadStatusAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = statusChangeSchema.parse({
      statusKey: text(form, "statusKey"),
      lostReasonKey: text(form, "lostReasonKey"),
      note: text(form, "note"),
    });
    await changeLeadStatus(await actor(), id, input);
    refresh(id);
    return { message: "Status updated." };
  });
}

export async function assignLeadAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const assigneeId = text(form, "assigneeId") || null;
    await assignLead(await actor(), id, assigneeId);
    refresh(id);
    return { message: assigneeId ? "Lead assigned." : "Lead unassigned." };
  });
}

export async function addLeadActivityAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = activitySchema.parse({
      kind: text(form, "kind"),
      note: text(form, "note"),
    });
    await addLeadActivity(await actor(), id, input);
    refresh(id);
    return { message: "Activity logged." };
  });
}

export async function updateLeadDetailsAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = leadDetailsSchema.parse(Object.fromEntries(form.entries()));
    await updateLeadDetails(await actor(), id, input);
    refresh(id);
    return { message: "Details saved." };
  });
}

export async function createLeadAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const lead = await createLead(
      await actor(),
      newLeadSchema.parse(Object.fromEntries(form.entries())),
    );
    revalidatePath("/admin/leads");
    return {
      message: `Lead ${lead.reference} added.`,
      redirectTo: `/admin/leads/${lead.id}`,
    };
  });
}

export async function archiveLeadAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await archiveLead(await actor(), id, text(form, "reason") ?? "");
    revalidatePath("/admin/leads");
    return { message: "Lead deleted.", redirectTo: "/admin/leads" };
  });
}
