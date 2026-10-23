"use server";

import { updateTag } from "next/cache";
import { revalidatePath } from "next/cache";

import { FACILITY_KEYS, HALL_LAYOUTS, MENU_COURSES } from "@/lib/content/catalog";
import { localizedFromForm } from "@/lib/i18n/localized";
import { getCurrentUser } from "@/server/auth/session";
import { CMS_TAG } from "@/server/cms/queries";
import { UnauthenticatedError } from "@/server/policies/authorize";
import {
  addAuspiciousDate,
  addGalleryItems,
  createServicePage,
  dateSchema,
  decorSchema,
  deleteAuspiciousDate,
  deleteDecorTheme,
  deleteHall,
  deleteMenu,
  deletePackage,
  deleteServicePage,
  hallSchema,
  homeSectionSchema,
  menuSchema,
  packageSchema,
  pageSchema,
  removeGalleryItem,
  saveDecorTheme,
  saveHall,
  saveHomeSection,
  saveMenu,
  savePackage,
  savePage,
  updateGalleryItem,
} from "@/server/services/cms";
import {
  assetMetaSchema,
  deleteAsset,
  registerSchema,
  registerUploadedAsset,
  updateAssetMeta,
  uploadSignature,
} from "@/server/services/media";

import { checkbox, runAction, text, type ActionState } from "./helpers";

async function actor() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/** Public pages are cached until the CMS changes (docs/architecture.md ADR-02). */
function publishChanges(adminPath?: string) {
  updateTag(CMS_TAG);
  if (adminPath) revalidatePath(adminPath);
}

const loc = localizedFromForm;
const seoFrom = (form: FormData) => ({ title: loc(form, "seo.title"), description: loc(form, "seo.description") });

// ─── Pages and homepage ─────────────────────────────────────────────────────

export async function savePageAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = pageSchema.parse({
      title: loc(form, "title"),
      summary: loc(form, "summary"),
      body: loc(form, "body"),
      heroAssetId: text(form, "heroAssetId"),
      seo: seoFrom(form),
      published: checkbox(form, "published"),
      sortOrder: text(form, "sortOrder"),
    });
    await savePage(await actor(), id, input);
    publishChanges("/admin/cms/pages");
    return { message: "Page saved. The website is updated." };
  });
}

export async function createServicePageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const page = await createServicePage(await actor(), { title: text(form, "title") ?? "", slug: text(form, "slug") ?? "" });
    publishChanges("/admin/cms/pages");
    return { message: "Service page created (unpublished).", redirectTo: `/admin/cms/pages/${page.id}` };
  });
}

export async function deleteServicePageAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteServicePage(await actor(), id);
    publishChanges("/admin/cms/pages");
    return { message: "Service page deleted.", redirectTo: "/admin/cms/pages" };
  });
}

export async function saveHomeSectionAction(type: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = homeSectionSchema.parse({
      heading: loc(form, "heading"),
      intro: loc(form, "intro"),
      subheading: loc(form, "subheading"),
      videoPath: text(form, "videoPath"),
      posterAssetId: text(form, "posterAssetId"),
      visible: checkbox(form, "visible"),
      sortOrder: text(form, "sortOrder"),
    });
    await saveHomeSection(await actor(), type, input);
    publishChanges("/admin/cms/home");
    return { message: "Section saved." };
  });
}

// ─── Halls ──────────────────────────────────────────────────────────────────

export async function saveHallAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = hallSchema.parse({
      name: loc(form, "name"),
      slug: text(form, "slug"),
      summary: loc(form, "summary"),
      description: loc(form, "description"),
      areaSqFt: text(form, "areaSqFt"),
      ceilingHeightFt: text(form, "ceilingHeightFt"),
      capacities: HALL_LAYOUTS.map((layout) => ({
        layout,
        minGuests: text(form, `capacity.${layout}.min`),
        maxGuests: text(form, `capacity.${layout}.max`),
      })),
      facilities: FACILITY_KEYS.filter((key) => checkbox(form, `facility.${key}`)).map((key) => ({
        key,
        note: text(form, `facility.${key}.note`) || undefined,
      })),
      eventTypeKeys: form.getAll("eventTypeKeys").map(String),
      slotsInfo: loc(form, "slotsInfo"),
      heroAssetId: text(form, "heroAssetId"),
      floorPlanAssetId: text(form, "floorPlanAssetId"),
      imageIds: form.getAll("imageIds").map(String),
      tourUrl: text(form, "tourUrl"),
      seo: seoFrom(form),
      published: checkbox(form, "published"),
      sortOrder: text(form, "sortOrder"),
    });
    const hallId = await saveHall(await actor(), id, input);
    publishChanges("/admin/cms/halls");
    return { message: "Venue saved. The website is updated.", redirectTo: id ? undefined : `/admin/cms/halls/${hallId}` };
  });
}

export async function deleteHallAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteHall(await actor(), id);
    publishChanges("/admin/cms/halls");
    return { message: "Venue deleted.", redirectTo: "/admin/cms/halls" };
  });
}

// ─── Menus, décor, packages ─────────────────────────────────────────────────

export async function saveMenuAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = menuSchema.parse({
      name: loc(form, "name"),
      category: text(form, "category"),
      description: loc(form, "description"),
      publicVisible: checkbox(form, "publicVisible"),
      sortOrder: text(form, "sortOrder"),
      courses: Object.fromEntries(MENU_COURSES.map((c) => [c, loc(form, `course.${c}`)])),
    });
    const menuId = await saveMenu(await actor(), id, input);
    publishChanges("/admin/cms/menus");
    return { message: "Menu saved.", redirectTo: id ? undefined : `/admin/cms/menus/${menuId}` };
  });
}

export async function deleteMenuAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteMenu(await actor(), id);
    publishChanges("/admin/cms/menus");
    return { message: "Menu deleted.", redirectTo: "/admin/cms/menus" };
  });
}

export async function saveDecorAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = decorSchema.parse({
      name: loc(form, "name"),
      slug: text(form, "slug"),
      description: loc(form, "description"),
      imageIds: form.getAll("imageIds").map(String),
      published: checkbox(form, "published"),
      sortOrder: text(form, "sortOrder"),
    });
    const themeId = await saveDecorTheme(await actor(), id, input);
    publishChanges("/admin/cms/decor");
    return { message: "Theme saved.", redirectTo: id ? undefined : `/admin/cms/decor/${themeId}` };
  });
}

export async function deleteDecorAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteDecorTheme(await actor(), id);
    publishChanges("/admin/cms/decor");
    return { message: "Theme deleted.", redirectTo: "/admin/cms/decor" };
  });
}

export async function savePackageAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = packageSchema.parse({
      name: loc(form, "name"),
      slug: text(form, "slug"),
      description: loc(form, "description"),
      inclusions: loc(form, "inclusions"),
      addOns: loc(form, "addOns"),
      terms: loc(form, "terms"),
      eventTypeKeys: form.getAll("eventTypeKeys").map(String),
      publicPrice: text(form, "publicPrice"),
      publicPriceNote: loc(form, "publicPriceNote"),
      showPublicPrice: checkbox(form, "showPublicPrice"),
      published: checkbox(form, "published"),
      sortOrder: text(form, "sortOrder"),
    });
    const packageId = await savePackage(await actor(), id, input);
    publishChanges("/admin/cms/packages");
    return { message: "Package saved.", redirectTo: id ? undefined : `/admin/cms/packages/${packageId}` };
  });
}

export async function deletePackageAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deletePackage(await actor(), id);
    publishChanges("/admin/cms/packages");
    return { message: "Package deleted.", redirectTo: "/admin/cms/packages" };
  });
}

// ─── Gallery and dates ──────────────────────────────────────────────────────

export async function addGalleryItemsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addGalleryItems(await actor(), text(form, "categoryId") ?? "", form.getAll("assetIds").map(String));
    publishChanges("/admin/cms/gallery");
    return { message: "Photos added to the gallery." };
  });
}

export async function updateGalleryItemAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await updateGalleryItem(await actor(), id, {
      featured: checkbox(form, "featured"),
      sortOrder: Math.max(0, Math.min(100_000, Number(text(form, "sortOrder")) || 0)),
    });
    publishChanges("/admin/cms/gallery");
    return { message: "Saved." };
  });
}

export async function removeGalleryItemAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await removeGalleryItem(await actor(), id);
    publishChanges("/admin/cms/gallery");
    return { message: "Removed from the gallery." };
  });
}

export async function addDateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addAuspiciousDate(await actor(), dateSchema.parse({ date: text(form, "date"), label: loc(form, "label"), note: loc(form, "note") }));
    publishChanges("/admin/cms/dates");
    return { message: "Date added." };
  });
}

export async function deleteDateAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    await deleteAuspiciousDate(await actor(), id);
    publishChanges("/admin/cms/dates");
    return { message: "Date removed." };
  });
}

// ─── Media ──────────────────────────────────────────────────────────────────

export async function getUploadSignatureAction(group: string) {
  const user = await actor();
  return uploadSignature(user, group);
}

export async function registerUploadAction(payload: unknown): Promise<ActionState> {
  return runAction(async () => {
    await registerUploadedAsset(await actor(), registerSchema.parse(payload));
    revalidatePath("/admin/cms/media");
    return { message: "Uploaded." };
  });
}

export async function updateAssetAction(id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = assetMetaSchema.parse({
      alt: loc(form, "alt"),
      caption: loc(form, "caption"),
      photographerCredit: text(form, "photographerCredit"),
      usagePermission: text(form, "usagePermission"),
      group: text(form, "group"),
    });
    await updateAssetMeta(await actor(), id, input);
    publishChanges("/admin/cms/media");
    return { message: "Saved." };
  });
}

export async function deleteAssetAction(id: string, _prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const { removedFromCloudinary } = await deleteAsset(await actor(), id);
    publishChanges("/admin/cms/media");
    return {
      message: removedFromCloudinary ? "File deleted." : "Removed from the library. Delete it in Cloudinary too if it's no longer needed.",
    };
  });
}
