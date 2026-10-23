"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/server/auth/session";
import { UnauthenticatedError } from "@/server/policies/authorize";

import { runAction, type ActionState } from "./helpers";

/** Marks the signed-in user's notifications as read (all, or one). */
export async function markNotificationsReadAction(notificationId: string | null, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    if (!user) throw new UnauthenticatedError();
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null, ...(notificationId ? { id: notificationId } : {}) },
      data: { readAt: new Date() },
    });
    revalidatePath("/admin", "layout");
  });
}
