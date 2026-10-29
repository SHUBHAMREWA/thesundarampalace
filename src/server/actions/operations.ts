"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  assignmentSchema,
  assignVendor,
  createExpense,
  deleteExpense,
  expenseSchema,
  removeVendorAssignment,
  saveVendor,
  updateExpense,
  vendorSchema,
} from "@/server/services/operations";
import { createTask, setTaskStatus, STATUSES, taskSchema, updateTask } from "@/server/services/tasks";

import { currentActor, formObject, runAction, text, type ActionState } from "./helpers";

// ─── Tasks ───────────────────────────────────────────────────────────────────

export async function createTaskAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const task = await createTask(await currentActor(), taskSchema.parse(formObject(form)));
    revalidatePath("/admin/tasks");
    if (task.bookingId) revalidatePath(`/admin/bookings/${task.bookingId}`);
    return { message: "Task added." };
  });
}

export async function updateTaskAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateTask(await currentActor(), id, taskSchema.parse(formObject(form)));
    revalidatePath("/admin/tasks");
    return { message: "Task saved." };
  });
}

export async function setTaskStatusAction(id: string, status: (typeof STATUSES)[number], _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await setTaskStatus(await currentActor(), id, z.enum(STATUSES).parse(status));
    revalidatePath("/admin/tasks");
    return { message: status === "DONE" ? "Marked done." : "Updated." };
  });
}

// ─── Vendors ─────────────────────────────────────────────────────────────────

export async function saveVendorAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await saveVendor(await currentActor(), id, vendorSchema.parse(formObject(form)));
    revalidatePath("/admin/vendors");
    return { message: "Vendor saved." };
  });
}

export async function assignVendorAction(bookingId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await assignVendor(await currentActor(), bookingId, assignmentSchema.parse(formObject(form)));
    revalidatePath(`/admin/bookings/${bookingId}`);
    return { message: "Vendor assigned." };
  });
}

export async function removeAssignmentAction(bookingId: string, assignmentId: string, _prev: ActionState, _form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await removeVendorAssignment(await currentActor(), assignmentId);
    revalidatePath(`/admin/bookings/${bookingId}`);
    return { message: "Removed." };
  });
}

// ─── Expenses ────────────────────────────────────────────────────────────────

export async function createExpenseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const expense = await createExpense(await currentActor(), expenseSchema.parse(formObject(form)));
    revalidatePath("/admin/expenses");
    if (expense.bookingId) revalidatePath(`/admin/bookings/${expense.bookingId}`);
    return { message: "Expense recorded." };
  });
}

export async function updateExpenseAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateExpense(await currentActor(), id, expenseSchema.parse(formObject(form)));
    revalidatePath("/admin/expenses");
    return { message: "Expense saved." };
  });
}

export async function deleteExpenseAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await deleteExpense(await currentActor(), id, text(form, "reason") ?? "");
    revalidatePath("/admin/expenses");
    return { message: "Expense removed." };
  });
}

