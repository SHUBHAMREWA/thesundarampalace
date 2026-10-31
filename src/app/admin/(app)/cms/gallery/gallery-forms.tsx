"use client";

import { X } from "lucide-react";
import { useActionState, useState } from "react";

import { DeleteButton } from "@/components/cms/delete-button";
import { DevicePreview, PhotoGuide } from "@/components/cms/device-preview";
import { UploadButton, type MediaOption } from "@/components/cms/media-picker";
import {
  ActionForm,
  ActionFeedback,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/forms/form-kit";
import { Input } from "@/components/ui/input";
import { cloudinaryImageUrl } from "@/lib/media/cloudinary";
import {
  addGalleryPhotosAction,
  deleteGalleryCategoryAction,
  removeGalleryItemAction,
  updateGalleryItemAction,
} from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

type Option = { value: string; label: string };

/** Upload photos, give each a title, pick (or name) their category, then add them. */
export function AddToGalleryForm({
  categories,
  uploads,
}: {
  categories: Option[];
  uploads: boolean;
}) {
  const [state, action] = useActionState(addGalleryPhotosAction, idleState);
  const [category, setCategory] = useState(categories[0]?.value ?? "new");
  const [photos, setPhotos] = useState<MediaOption[]>([]);
  const [shownAt, setShownAt] = useState(state.at);
  // A successful add clears the list for the next batch.
  if (state.at !== shownAt) {
    setShownAt(state.at);
    if (state.ok) setPhotos([]);
  }
  return (
    <ActionForm action={action} className="space-y-5">
      <ActionFeedback state={state} />
      <div className="flex flex-wrap items-start gap-4">
        <SelectField
          name="categoryId"
          label="Category"
          options={[
            ...categories,
            { value: "new", label: "Other — new category…" },
          ]}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full max-w-xs"
        />
        {category === "new" ? (
          <TextField
            name="newCategory"
            label="New category name"
            placeholder="e.g. Mehndi"
            maxLength={40}
            className="w-full max-w-xs"
          />
        ) : null}
      </div>

      <PhotoGuide guide="gallery" />
      <UploadButton
        upload={{
          enabled: uploads,
          group: "gallery",
          kind: "image",
          alt: "Celebration at The Sundaram Palace",
        }}
        multiple
        onAdded={(added) => setPhotos((p) => [...p, ...added])}
      />

      {photos.length ? (
        <DevicePreview src={photos[photos.length - 1].publicId} layout="gallery" />
      ) : null}
      {photos.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="relative rounded-md border border-border p-2"
            >
              <input type="hidden" name="assetIds" value={photo.id} />
              {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
              <img
                src={cloudinaryImageUrl(photo.publicId, 400)}
                alt=""
                className="aspect-[4/3] w-full rounded object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  setPhotos((p) => p.filter((o) => o.id !== photo.id))
                }
                aria-label="Don't add this photo"
                className="absolute top-3 right-3 rounded-full bg-surface/90 p-1 text-text-muted hover:text-danger"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
              <Input
                name={`title.${photo.id}`}
                placeholder="Title (shown on hover)"
                aria-label="Title"
                maxLength={120}
                className="mt-2 h-9"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-muted">
          Upload one or many photos, write a title under each, then press “Add
          to gallery”.
        </p>
      )}
      {state.fieldErrors?.photos ? (
        <p className="text-sm text-danger">{state.fieldErrors.photos}</p>
      ) : null}
      <SubmitButton disabled={!photos.length}>Add to gallery</SubmitButton>
    </ActionForm>
  );
}

/** One gallery photo: its title and category, with delete. */
export function GalleryPhoto({
  id,
  publicId,
  title,
  categoryId,
  categories,
}: {
  id: string;
  publicId: string;
  title: string;
  categoryId: string;
  categories: Option[];
}) {
  const [state, action] = useActionState(
    updateGalleryItemAction.bind(null, id),
    idleState,
  );
  return (
    <li className="rounded-md border border-border p-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail */}
      <img
        src={cloudinaryImageUrl(publicId, 400)}
        alt={title}
        className="aspect-[4/3] w-full rounded object-cover"
      />
      <ActionForm action={action} className="mt-2 space-y-2">
        <Input
          name="title"
          defaultValue={title}
          placeholder="Title (shown on hover)"
          aria-label="Title"
          maxLength={120}
          className="h-9"
        />
        <select
          name="categoryId"
          defaultValue={categoryId}
          aria-label="Category"
          className="h-9 w-full rounded-md border border-input bg-surface px-2 text-sm"
        >
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="flex items-center justify-between gap-2">
          <SubmitButton size="sm" variant="outline">
            Save
          </SubmitButton>
          <DeleteButton
            action={removeGalleryItemAction.bind(null, id)}
            title="Delete this photo?"
            description="It is removed from the gallery and, when no other page uses it, deleted from Cloudinary too."
          />
        </div>
        <ActionFeedback state={state} />
      </ActionForm>
    </li>
  );
}

/** Delete button for a category with no photos. */
export function DeleteCategoryButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  return (
    <DeleteButton
      action={deleteGalleryCategoryAction.bind(null, id)}
      title={`Delete the “${name}” category?`}
      description="It has no photos, so nothing on the website changes."
      label="Delete category"
    />
  );
}
