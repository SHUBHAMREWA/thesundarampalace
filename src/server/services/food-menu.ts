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
import {
  authenticatedPdfPageUrl,
  cloudinaryFolder,
  cloudinaryReady,
  destroyImage,
  downloadAuthenticatedPdf,
} from "@/server/media/cloudinary-images";
import { signParams, verifyUploadResponse } from "@/server/media/cloudinary-sign";
import { assertPermission, type Actor } from "@/server/policies/authorize";
import { env } from "@/lib/env";
import { z } from "zod";

import { recordActivity } from "./activity";
import { RuleError } from "./errors";
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

// ─── Ready-made menu PDF (uploaded to Cloudinary) ───────────────────────────

/**
 * The caterer's ready-made menu PDF, sent as it is. Uploaded from the Food
 * menu screen straight to Cloudinary as a private ("authenticated") file, so
 * nothing large lives in the project or the database: only this small record.
 */
const READY_KEY = "readyMenuPdf";
/** Cloudinary's file limit on the free plan. */
export const READY_MENU_MAX_MB = 10;

const readyMenuSchema = z.object({
  publicId: z.string().min(1).max(300),
  pages: z.number().int().min(1).max(200),
  bytes: z.number().int().min(1),
  fileName: z.string().max(200),
  uploadedAt: z.string(),
});
export type ReadyMenuPdf = z.infer<typeof readyMenuSchema>;

export async function getReadyMenuPdf(): Promise<ReadyMenuPdf | null> {
  const row = await db.siteSetting.findUnique({ where: { key: READY_KEY } });
  const parsed = row ? readyMenuSchema.safeParse(row.value) : null;
  return parsed?.success ? parsed.data : null;
}

/** Signed parameters for the browser to upload a PDF straight to Cloudinary. */
export function readyMenuUploadSignature(actor: Actor) {
  assertPermission(actor, "catalog.manage");
  if (!cloudinaryReady()) throw new RuleError("Cloudinary is not connected, so files can't be uploaded.");
  const e = env();
  const params: Record<string, string> = {
    allowed_formats: "pdf",
    folder: cloudinaryFolder("menu"),
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: "authenticated",
  };
  return {
    params,
    signature: signParams(params, e.CLOUDINARY_API_SECRET!),
    apiKey: e.CLOUDINARY_API_KEY!,
    cloudName: e.CLOUDINARY_CLOUD_NAME!,
  };
}

const uploadResultSchema = z.object({
  public_id: z.string().min(1).max(300),
  version: z.union([z.number(), z.string()]),
  signature: z.string().min(10).max(100),
  format: z.literal("pdf"),
  type: z.literal("authenticated"),
  pages: z.number().int().min(1),
  bytes: z.number().int().min(1),
  original_filename: z.string().max(200).optional(),
});

/** Records an uploaded PDF (after checking Cloudinary's signature) and removes the previous one. */
export async function saveReadyMenuPdf(actor: Actor, input: unknown): Promise<ReadyMenuPdf> {
  assertPermission(actor, "catalog.manage");
  const upload = uploadResultSchema.parse(input);
  if (!verifyUploadResponse(upload, env().CLOUDINARY_API_SECRET!))
    throw new RuleError("The upload could not be verified. Please upload the PDF again.");
  if (!upload.public_id.startsWith(`${cloudinaryFolder("menu")}/`))
    throw new RuleError("Unexpected upload location.");
  const previous = await getReadyMenuPdf();
  const record: ReadyMenuPdf = {
    publicId: upload.public_id,
    pages: upload.pages,
    bytes: upload.bytes,
    fileName: `${upload.original_filename ?? "menu"}.pdf`,
    uploadedAt: new Date().toISOString(),
  };
  const value = record as unknown as Prisma.InputJsonValue;
  await db.siteSetting.upsert({
    where: { key: READY_KEY },
    update: { value, updatedById: actor.id },
    create: { key: READY_KEY, value, updatedById: actor.id },
  });
  if (previous && previous.publicId !== record.publicId) await destroyImage(previous.publicId, "authenticated");
  await recordAudit({
    actorId: actor.id,
    action: "food_menu.ready_pdf_uploaded",
    entityType: "site_setting",
    entityId: READY_KEY,
    summary: { pages: record.pages, bytes: record.bytes },
  });
  return record;
}

export async function removeReadyMenuPdf(actor: Actor) {
  assertPermission(actor, "catalog.manage");
  const current = await getReadyMenuPdf();
  if (!current) return;
  await destroyImage(current.publicId, "authenticated");
  await db.siteSetting.deleteMany({ where: { key: READY_KEY } });
  await recordAudit({
    actorId: actor.id,
    action: "food_menu.ready_pdf_removed",
    entityType: "site_setting",
    entityId: READY_KEY,
  });
}

/** A page of the ready-made PDF as a JPEG preview (bytes), or null. */
export async function readyMenuPagePreview(page: number): Promise<Buffer | null> {
  const current = await getReadyMenuPdf();
  if (!current || page < 1 || page > current.pages) return null;
  const url = authenticatedPdfPageUrl(current.publicId, page, 900);
  const response = url
    ? await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" }).catch(() => null)
    : null;
  return response?.ok ? Buffer.from(await response.arrayBuffer()) : null;
}

/** The ready-made PDF file as a stream from Cloudinary, or null. */
export async function readyMenuPdfFile() {
  const current = await getReadyMenuPdf();
  if (!current) return null;
  const response = await downloadAuthenticatedPdf(current.publicId);
  return response?.body ? { body: response.body, record: current } : null;
}
