"use server";

import { revalidatePath } from "next/cache";

import {
  resetBookingFoodMenu,
  resetFoodMenu,
  saveBookingFoodMenu,
  saveFoodMenu,
} from "@/server/services/food-menu";

import { currentActor, runAction, type ActionState } from "./helpers";

/** Saves the edited food menu (sent as JSON from the editor). */
export async function saveFoodMenuAction(menu: unknown): Promise<ActionState> {
  return runAction(async () => {
    await saveFoodMenu(await currentActor(), menu);
    revalidatePath("/admin/catalog");
    return { message: "Menu saved. Preview or download it above." };
  });
}

/** Puts back the menu as supplied (the caterer's PDF of 28 Oct 2026). */
export async function resetFoodMenuAction(
  _prev?: ActionState,
  _form?: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await resetFoodMenu(await currentActor());
    revalidatePath("/admin/catalog");
    return { message: "Menu reset to the original." };
  });
}

/** Saves one booking's menu (its own copy, with the picked items). */
export async function saveBookingFoodMenuAction(
  bookingId: string,
  menu: unknown,
): Promise<ActionState> {
  return runAction(async () => {
    await saveBookingFoodMenu(await currentActor(), bookingId, menu);
    revalidatePath(`/admin/bookings/${bookingId}`);
    return {
      message: "Menu saved for this booking. Preview or download it above.",
    };
  });
}

/** Starts this booking's menu again from the venue menu. */
export async function resetBookingFoodMenuAction(
  bookingId: string,
): Promise<ActionState> {
  return runAction(async () => {
    await resetBookingFoodMenu(await currentActor(), bookingId);
    revalidatePath(`/admin/bookings/${bookingId}`);
    return { message: "Menu started again from the venue menu." };
  });
}
