"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ROLES, type RoleKey } from "@/lib/permissions/registry";
import { getCurrentUser } from "@/server/auth/session";
import { UnauthenticatedError } from "@/server/policies/authorize";
import { createStaff, createStaffSchema, setStaffActive, setStaffRole } from "@/server/services/staff";

import { runAction, text, type ActionState } from "./helpers";

async function actor() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

const roleKeySchema = z.enum(ROLES.map((r) => r.key) as [RoleKey, ...RoleKey[]]);

export async function createStaffAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = createStaffSchema.parse({
      name: text(form, "name"),
      email: text(form, "email"),
      roleKey: text(form, "roleKey"),
      temporaryPassword: text(form, "temporaryPassword"),
    });
    await createStaff(await actor(), input);
    revalidatePath("/admin/staff");
    return { message: `Account created for ${input.email}. Share the temporary password privately.` };
  });
}

export async function setStaffRoleAction(userId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await setStaffRole(await actor(), userId, roleKeySchema.parse(text(form, "roleKey")));
    revalidatePath("/admin/staff");
    return { message: "Role updated. Their sessions were signed out." };
  });
}

export async function setStaffActiveAction(userId: string, active: boolean, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await setStaffActive(await actor(), userId, active);
    revalidatePath("/admin/staff");
    return { message: active ? "Account reactivated." : "Account deactivated and signed out." };
  });
}
