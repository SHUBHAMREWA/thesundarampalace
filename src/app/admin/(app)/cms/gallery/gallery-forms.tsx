"use client";

import { useActionState, useRef } from "react";

import { MediaMultiPicker, type MediaOption } from "@/components/cms/media-picker";
import { ActionForm, ActionFeedback, SelectField, SubmitButton } from "@/components/forms/form-kit";
import { Input } from "@/components/ui/input";
import { addGalleryItemsAction, removeGalleryItemAction, updateGalleryItemAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

export function AddToGalleryForm({ categories, media }: { categories: { value: string; label: string }[]; media: MediaOption[] }) {
  const [state, action] = useActionState(addGalleryItemsAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <ActionForm ref={formRef} action={action} className="space-y-4" key={state.at}>
      <ActionFeedback state={state} />
      <SelectField name="categoryId" label="Category" options={categories} className="max-w-xs" />
      <MediaMultiPicker name="assetIds" label="Photos to add" options={media} />
      {state.fieldErrors?.assetIds ? <p className="text-sm text-danger">{state.fieldErrors.assetIds}</p> : null}
      <SubmitButton>Add to gallery</SubmitButton>
    </ActionForm>
  );
}

export function GalleryItemControls({ id, featured, sortOrder }: { id: string; featured: boolean; sortOrder: number }) {
  const [state, action] = useActionState(updateGalleryItemAction.bind(null, id), idleState);
  const [removeState, removeAction] = useActionState(removeGalleryItemAction.bind(null, id), idleState);
  return (
    <div className="mt-2 space-y-2">
      <ActionForm action={action} className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-1">
          <input type="checkbox" name="featured" defaultChecked={featured} className="accent-primary" /> Featured
        </label>
        <Input name="sortOrder" type="number" min={0} defaultValue={sortOrder} aria-label="Sort order" className="h-8 w-16 bg-surface" />
        <SubmitButton size="sm" variant="outline">Save</SubmitButton>
      </ActionForm>
      <ActionForm action={removeAction}>
        <SubmitButton size="sm" variant="ghost" className="text-danger">Remove</SubmitButton>
      </ActionForm>
      <ActionFeedback state={state} />
      <ActionFeedback state={removeState} />
    </div>
  );
}
