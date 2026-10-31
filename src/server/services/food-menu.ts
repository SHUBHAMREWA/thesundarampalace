import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  cleanMenu,
  DEFAULT_FOOD_MENU,
  foodMenuSchema,
  menuForBooking,
  printableMenu,
  type FoodMenu,
} from "@/lib/menu/food-menu";
import {
  renderFoodMenuHtml,
  type FoodMenuAssets,
} from "@/lib/pdf/food-menu-html";
import { documentAssets } from "@/server/documents/assets";
import { renderPdf } from "@/server/documents/renderer";
import { assertPermission, type Actor } from "@/server/policies/authorize";

import { recordActivity } from "./activity";
import { bookingVisibility } from "./bookings";
import { NotFoundError } from "./leads";

import { recordAudit } from "./audit";

/** The food menu (owner, 29 Oct 2026): edited in the CRM, printed as a PDF. Stored as one site setting. */
const KEY = "foodMenu";
const ASSET_DIR = path.join(process.cwd(), "src", "lib", "pdf", "menu-assets");

export async function getFoodMenu(): Promise<FoodMenu> {
  const row = await db.siteSetting.findUnique({ where: { key: KEY } });
  const parsed = row ? foodMenuSchema.safeParse(row.value) : null;
  return parsed?.success ? parsed.data : DEFAULT_FOOD_MENU;
}

export async function saveFoodMenu(
  actor: Actor,
  input: unknown,
): Promise<FoodMenu> {
  assertPermission(actor, "catalog.manage");
  const menu = foodMenuSchema.parse(input);
  const value = menu as unknown as Prisma.InputJsonValue;
  await db.siteSetting.upsert({
    where: { key: KEY },
    update: { value, updatedById: actor.id },
    create: { key: KEY, value, updatedById: actor.id },
  });
  await recordAudit({
    actorId: actor.id,
    action: "food_menu.saved",
    entityType: "site_setting",
    entityId: KEY,
    summary: { sections: menu.sections.length },
  });
  return menu;
}

// ─── A booking's own menu ────────────────────────────────────────────────────

async function visibleBooking(actor: Actor, bookingId: string) {
  const booking = await db.booking.findFirst({
    where: { AND: [{ id: bookingId }, bookingVisibility(actor)] },
    select: { id: true, reference: true, foodMenu: true },
  });
  if (!booking) throw new NotFoundError("Booking");
  return booking;
}

/**
 * A booking's menu: its saved copy, or (not made yet) the venue menu with
 * every item unpicked. `saved` says which.
 */
export async function getBookingFoodMenu(actor: Actor, bookingId: string) {
  const booking = await visibleBooking(actor, bookingId);
  const parsed = booking.foodMenu
    ? foodMenuSchema.safeParse(booking.foodMenu)
    : null;
  if (parsed?.success)
    return { reference: booking.reference, menu: parsed.data, saved: true };
  return {
    reference: booking.reference,
    menu: menuForBooking(await getFoodMenu()),
    saved: false,
  };
}

export async function saveBookingFoodMenu(
  actor: Actor,
  bookingId: string,
  input: unknown,
): Promise<FoodMenu> {
  assertPermission(actor, "bookings.edit");
  const booking = await visibleBooking(actor, bookingId);
  const menu = cleanMenu(foodMenuSchema.parse(input));
  const picked = menu.sections.reduce(
    (n, s) =>
      n +
      s.groups.reduce((m, g) => m + (g.picked?.filter(Boolean).length ?? 0), 0),
    0,
  );
  await db.booking.update({
    where: { id: booking.id },
    data: { foodMenu: menu as unknown as Prisma.InputJsonValue },
  });
  await recordActivity({
    entityType: "booking",
    entityId: booking.id,
    actorId: actor.id,
    kind: "MENU",
    message: `Food menu saved (${picked} item${picked === 1 ? "" : "s"} picked)`,
  });
  return menu;
}

/**
 * The menu to preview or print: for a booking only its picked (blue) items —
 * nothing is picked until staff tick items — or the venue menu.
 */
export async function menuToPrint(actor: Actor, bookingId: string | null) {
  if (!bookingId)
    return {
      menu: await getFoodMenu(),
      fileName: "The Sundaram Palace food menu.pdf",
    };
  const { menu, reference } = await getBookingFoodMenu(actor, bookingId);
  return {
    menu: printableMenu(menu),
    fileName: `Food menu ${reference}.pdf`,
  };
}

/** Starts the booking's menu again from the venue menu (nothing picked). */
export async function resetBookingFoodMenu(actor: Actor, bookingId: string) {
  assertPermission(actor, "bookings.edit");
  const booking = await visibleBooking(actor, bookingId);
  await db.booking.update({
    where: { id: booking.id },
    data: { foodMenu: Prisma.DbNull },
  });
}

export async function resetFoodMenu(actor: Actor) {
  assertPermission(actor, "catalog.manage");
  await db.siteSetting.deleteMany({ where: { key: KEY } });
  await recordAudit({
    actorId: actor.id,
    action: "food_menu.reset",
    entityType: "site_setting",
    entityId: KEY,
  });
}

let images: Pick<FoodMenuAssets, "coverBg" | "pageTop" | "pageBottom"> | null =
  null;
/** The design background images as data URIs (also used by the CRM page editor). */
export function menuImages() {
  if (!images) {
    const uri = (file: string) =>
      `data:image/jpeg;base64,${readFileSync(path.join(ASSET_DIR, file)).toString("base64")}`;
    images = {
      coverBg: uri("cover-bg.jpg"),
      pageTop: uri("page-top.jpg"),
      pageBottom: uri("page-bottom.jpg"),
    };
  }
  return images;
}

export function foodMenuHtml(menu: FoodMenu): string {
  const { tokensCss, fontsCss } = documentAssets();
  return renderFoodMenuHtml(menu, { tokensCss, fontsCss, ...menuImages() });
}

/** The menu as a PDF; null when no PDF renderer is set up (the printable page is used instead). */
export async function foodMenuPdf(menu: FoodMenu): Promise<Buffer | null> {
  return renderPdf(foodMenuHtml(menu), "Food menu", { fullBleed: true });
}
