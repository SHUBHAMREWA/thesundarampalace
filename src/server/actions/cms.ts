"use server";

import { updateTag } from "next/cache";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { MENU_COURSES } from "@/lib/content/catalog";
import { localizedFromForm } from "@/lib/i18n/localized";
import { getCurrentUser } from "@/server/auth/session";
import { CMS_TAG } from "@/server/cms/queries";
import { UnauthenticatedError } from "@/server/policies/authorize";
import {
  aboutPhotosSchema,
  addGalleryPhotos,
  addGalleryPhotosSchema,
  deleteGalleryCategory,
  createServicePage,
  decorSchema,
  deleteDecorTheme,
  deleteHall,
  deleteMenu,
  deleteServicePage,
  deleteTestimonial,
  galleryItemSchema,
  hallSchema,
  homeSectionSchema,
  menuSchema,
  moveHomeSection,
  pageSchema,
  removeGalleryItem,
  saveAboutPhotos,
  saveDecorTheme,
  saveHall,
  saveHomeSection,
  saveMenu,
  saveTestimonial,
  testimonialSchema,
  savePage,
  updateGalleryItem,
} from "@/server/services/cms";
import {
  blogPostSchema,
  deleteBlogPost,
  saveBlogPost,
} from "@/server/services/blog";
import {
  assetMetaSchema,
  deleteAsset,
  registerSchema,
  registerUploadedAsset,
  type MediaOption,
  replaceAssetFile,
  replaceSchema,
  updateAssetMeta,
  uploadSignature,
} from "@/server/services/media";

import { checkbox, runAction, text, type ActionState } from "./helpers";

async function actor() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/**
 * After deleting the record an editor is looking at, go back to its list on
 * the server. Refreshing the deleted record's own page would show "not found".
 */
function leaveDeletedPage(state: ActionState): ActionState {
  if (state.ok && state.redirectTo) redirect(state.redirectTo);
  return state;
}

/** Public pages are cached until the CMS changes (docs/architecture.md ADR-02). */
function publishChanges(adminPath?: string) {
  updateTag(CMS_TAG);
  if (adminPath) revalidatePath(adminPath);
}

const loc = localizedFromForm;
const seoFrom = (form: FormData) => ({
  title: loc(form, "seo.title"),
  description: loc(form, "seo.description"),
});

// ─── Pages and homepage ─────────────────────────────────────────────────────

export async function savePageAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = pageSchema.parse({
      title: loc(form, "title"),
      summary: loc(form, "summary"),
      body: loc(form, "body"),
      heroAssetId: text(form, "heroAssetId"),
      seo: seoFrom(form),
      imageIds: form.getAll("imageIds").map(String),
      published: checkbox(form, "published"),
      sortOrder: text(form, "sortOrder"),
    });
    await savePage(await actor(), id, input);
    publishChanges("/admin/cms/pages");
    return { message: "Page saved. The website is updated." };
  });
}

export async function saveAboutPhotosAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await saveAboutPhotos(
      await actor(),
      aboutPhotosSchema.parse({
        headerAssetId: text(form, "headerAssetId"),
        ownerAssetId: text(form, "ownerAssetId"),
      }),
    );
    publishChanges("/admin/cms/about");
    return { message: "About page photos saved. The website is updated." };
  });
}

export async function createServicePageAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const page = await createServicePage(await actor(), {
      title: text(form, "title") ?? "",
      slug: text(form, "slug") ?? "",
    });
    publishChanges("/admin/cms/pages");
    return {
      message: "Service page created (unpublished).",
      redirectTo: `/admin/cms/pages/${page.id}`,
    };
  });
}

export async function deleteServicePageAction(
  id: string,
  _prev: ActionState,
): Promise<ActionState> {
  return leaveDeletedPage(
    await runAction(async () => {
      await deleteServicePage(await actor(), id);
      publishChanges("/admin/cms/pages");
      return {
        message: "Service page deleted.",
        redirectTo: "/admin/cms/pages",
      };
    }),
  );
}

export async function saveHomeSectionAction(
  type: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = homeSectionSchema.parse({
      heading: loc(form, "heading"),
      intro: loc(form, "intro"),
      subheading: loc(form, "subheading"),
      heroMedia: text(form, "heroMedia") ?? undefined,
      slideAssetIds: form.getAll("slideAssetIds").map(String),
      videoAssetId: text(form, "videoAssetId"),
      pictureAssetIds: form.getAll("pictureAssetIds").map(String),
      videoPath: text(form, "videoPath"),
      posterAssetId: text(form, "posterAssetId"),
      visible: checkbox(form, "visible"),
    });
    await saveHomeSection(await actor(), type, input);
    publishChanges("/admin/cms/home");
    return { message: "Section saved." };
  });
}

/** Up/down buttons on the Homepage list (plain forms, so they work before the page finishes loading). */
export async function moveHomeSectionAction(
  type: string,
  direction: "up" | "down",
): Promise<void> {
  await moveHomeSection(await actor(), type, direction);
  publishChanges("/admin/cms/home");
}

// ─── Halls ──────────────────────────────────────────────────────────────────

export async function saveHallAction(
  id: string | null,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = hallSchema.parse({
      name: loc(form, "name"),
      slug: text(form, "slug"),
      description: loc(form, "description"),
      imageIds: form.getAll("imageIds").map(String),
      published: checkbox(form, "published"),
      sortOrder: text(form, "sortOrder"),
    });
    const hallId = await saveHall(await actor(), id, input);
    publishChanges("/admin/cms/halls");
    return {
      message: "Venue saved. The website is updated.",
      redirectTo: id ? undefined : `/admin/cms/halls/${hallId}`,
    };
  });
}

export async function deleteHallAction(
  id: string,
  _prev: ActionState,
  form?: FormData,
): Promise<ActionState> {
  return leaveDeletedPage(
    await runAction(async () => {
      const { photosDeleted, archived } = await deleteHall(await actor(), id, {
        deletePhotos: form ? checkbox(form, "deletePhotos") : false,
      });
      publishChanges("/admin/cms/halls");
      revalidatePath("/admin/cms/media");
      return {
        message: `Venue ${archived ? "removed (old bookings keep its name)" : "deleted"}${photosDeleted ? `, with ${photosDeleted} photo${photosDeleted === 1 ? "" : "s"}` : ""}.`,
        redirectTo: "/admin/cms/halls",
      };
    }),
  );
}

// ─── Menus, décor ─────────────────────────────────────────────────

export async function saveMenuAction(
  id: string | null,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = menuSchema.parse({
      name: loc(form, "name"),
      category: text(form, "category"),
      description: loc(form, "description"),
      publicVisible: checkbox(form, "publicVisible"),
      sortOrder: text(form, "sortOrder"),
      courses: Object.fromEntries(
        MENU_COURSES.map((c) => [c, loc(form, `course.${c}`)]),
      ),
    });
    const menuId = await saveMenu(await actor(), id, input);
    publishChanges("/admin/cms/menus");
    return {
      message: "Menu saved.",
      redirectTo: id ? undefined : `/admin/cms/menus/${menuId}`,
    };
  });
}

export async function deleteMenuAction(
  id: string,
  _prev: ActionState,
): Promise<ActionState> {
  return leaveDeletedPage(
    await runAction(async () => {
      await deleteMenu(await actor(), id);
      publishChanges("/admin/cms/menus");
      return { message: "Menu deleted.", redirectTo: "/admin/cms/menus" };
    }),
  );
}

export async function saveDecorAction(
  id: string | null,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
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
    return {
      message: "Theme saved.",
      redirectTo: id ? undefined : `/admin/cms/decor/${themeId}`,
    };
  });
}

export async function deleteDecorAction(
  id: string,
  _prev: ActionState,
): Promise<ActionState> {
  return leaveDeletedPage(
    await runAction(async () => {
      await deleteDecorTheme(await actor(), id);
      publishChanges("/admin/cms/decor");
      return { message: "Theme deleted.", redirectTo: "/admin/cms/decor" };
    }),
  );
}

export async function saveTestimonialAction(
  id: string | null,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = testimonialSchema.parse({
      name: text(form, "name") ?? "",
      event: loc(form, "event"),
      quote: loc(form, "quote"),
      rating: text(form, "rating"),
      photoAssetId: text(form, "photoAssetId"),
      consent: checkbox(form, "consent"),
      published: checkbox(form, "published"),
    });
    const savedId = await saveTestimonial(await actor(), id, input);
    publishChanges("/admin/cms/testimonials");
    return {
      message: "Testimonial saved.",
      redirectTo: id ? undefined : `/admin/cms/testimonials/${savedId}`,
    };
  });
}

export async function deleteTestimonialAction(
  id: string,
  _prev: ActionState,
): Promise<ActionState> {
  return leaveDeletedPage(
    await runAction(async () => {
      await deleteTestimonial(await actor(), id);
      publishChanges("/admin/cms/testimonials");
      return {
        message: "Testimonial deleted.",
        redirectTo: "/admin/cms/testimonials",
      };
    }),
  );
}

export async function saveBlogPostAction(
  id: string | null,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const input = blogPostSchema.parse({
      title: loc(form, "title"),
      slug: text(form, "slug"),
      summary: loc(form, "summary"),
      content: loc(form, "content"),
      coverAssetId: text(form, "coverAssetId"),
      categoryKey: text(form, "categoryKey"),
      tags: text(form, "tags"),
      author: text(form, "author"),
      seoTitle: loc(form, "seo.title"),
      seoDescription: loc(form, "seo.description"),
      published: checkbox(form, "published"),
    });
    const postId = await saveBlogPost(await actor(), id, input);
    publishChanges("/admin/cms/blog");
    return {
      message: input.published
        ? "Post saved. It is live on the website."
        : "Post saved as a draft (not on the website).",
      redirectTo: id ? undefined : `/admin/cms/blog/${postId}`,
    };
  });
}

export async function deleteBlogPostAction(
  id: string,
  _prev: ActionState,
): Promise<ActionState> {
  return leaveDeletedPage(
    await runAction(async () => {
      await deleteBlogPost(await actor(), id);
      publishChanges("/admin/cms/blog");
      return { message: "Post deleted.", redirectTo: "/admin/cms/blog" };
    }),
  );
}

// ─── Gallery ────────────────────────────────────────────────────────────────

export async function addGalleryPhotosAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const assetIds = form.getAll("assetIds").map(String);
    await addGalleryPhotos(
      await actor(),
      addGalleryPhotosSchema.parse({
        categoryId: text(form, "categoryId") ?? "",
        newCategory: text(form, "newCategory") ?? "",
        photos: assetIds.map((assetId) => ({
          assetId,
          title: text(form, `title.${assetId}`) ?? "",
        })),
      }),
    );
    publishChanges("/admin/cms/gallery");
    return {
      message:
        assetIds.length === 1
          ? "Photo added to the gallery."
          : `${assetIds.length} photos added to the gallery.`,
    };
  });
}

export async function updateGalleryItemAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await updateGalleryItem(
      await actor(),
      id,
      galleryItemSchema.parse({
        title: text(form, "title") ?? "",
        categoryId: text(form, "categoryId") ?? "",
      }),
    );
    publishChanges("/admin/cms/gallery");
    return { message: "Saved." };
  });
}

export async function removeGalleryItemAction(
  id: string,
): Promise<ActionState> {
  return runAction(async () => {
    await removeGalleryItem(await actor(), id);
    publishChanges("/admin/cms/gallery");
    return { message: "Photo deleted." };
  });
}

export async function deleteGalleryCategoryAction(
  id: string,
): Promise<ActionState> {
  return runAction(async () => {
    await deleteGalleryCategory(await actor(), id);
    publishChanges("/admin/cms/gallery");
    return { message: "Category deleted." };
  });
}

// ─── Media ──────────────────────────────────────────────────────────────────

export async function getUploadSignatureAction(
  group: string,
  kind: "video" | "other" = "other",
) {
  const user = await actor();
  return uploadSignature(user, group, kind === "video" ? "video" : "other");
}

export async function registerUploadAction(
  payload: unknown,
): Promise<ActionState> {
  return runAction(async () => {
    await registerUploadedAsset(await actor(), registerSchema.parse(payload));
    revalidatePath("/admin/cms/media");
    return { message: "Uploaded." };
  });
}

/** Upload from inside a picker: records the file and hands it back so it can be chosen at once. */
export async function uploadToLibraryAction(
  payload: unknown,
): Promise<{ ok: true; option: MediaOption } | { ok: false; message: string }> {
  let option: MediaOption | null = null;
  const state = await runAction(async () => {
    const asset = await registerUploadedAsset(
      await actor(),
      registerSchema.parse(payload),
    );
    option = {
      id: asset.id,
      label: (asset.alt as { en?: string }).en || asset.publicId,
      publicId: asset.publicId,
      resourceType: asset.resourceType,
      group: asset.group,
    };
    revalidatePath("/admin/cms/media");
  });
  if (!state.ok || !option)
    return {
      ok: false,
      message:
        state.fieldErrors?.file ?? state.message ?? "Upload could not be saved",
    };
  return { ok: true, option };
}

export async function updateAssetAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
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

export async function replaceAssetAction(
  id: string,
  payload: unknown,
): Promise<ActionState> {
  return runAction(async () => {
    const { removedOld } = await replaceAssetFile(
      await actor(),
      id,
      replaceSchema.parse(payload),
    );
    publishChanges("/admin/cms/media");
    return {
      message: removedOld
        ? "File replaced. The old file was deleted from Cloudinary."
        : "File replaced. Delete the old file in Cloudinary too if it's still there.",
    };
  });
}

/** Delete button inside a photo picker: removes the file from every page, the library and Cloudinary. */
export async function deletePickerAssetAction(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  const state = await runAction(async () => {
    const { removedFromCloudinary } = await deleteAsset(await actor(), id, {
      everywhere: true,
    });
    publishChanges("/admin/cms/media");
    return {
      message: removedFromCloudinary
        ? "Photo deleted, also from Cloudinary."
        : "Photo removed from the website. Delete it in Cloudinary too if it is still there.",
    };
  });
  return {
    ok: state.ok,
    message:
      state.message ??
      (state.ok ? "Deleted." : "The photo could not be deleted."),
  };
}

export async function deleteAssetAction(
  id: string,
  _prev: ActionState,
): Promise<ActionState> {
  return runAction(async () => {
    const { removedFromCloudinary } = await deleteAsset(await actor(), id);
    publishChanges("/admin/cms/media");
    return {
      message: removedFromCloudinary
        ? "File deleted."
        : "Removed from the library. Delete it in Cloudinary too if it's no longer needed.",
    };
  });
}
