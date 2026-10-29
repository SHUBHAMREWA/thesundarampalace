"use client";

import { useActionState, useState } from "react";

import { DeleteButton } from "@/components/cms/delete-button";
import { MediaMultiPicker, type MediaOption } from "@/components/cms/media-picker";
import { ActionForm, ActionFeedback, CheckboxField, LocalizedField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { Card, CardContent } from "@/components/ui/card";
import type { Localized } from "@/lib/i18n/localized";
import { deleteHallAction, saveHallAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

export type HallDefaults = {
  name: Localized | null;
  slug: string;
  description: Localized | null;
  imageIds: string[];
  published: boolean;
  sortOrder: number;
};

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/** A venue is just a title, a description and its photos. */
export function HallEditor({
  id,
  defaults,
  images,
  uploads,
}: {
  id: string | null;
  defaults: HallDefaults;
  images: MediaOption[];
  uploads: boolean;
}) {
  const [state, action] = useActionState(saveHallAction.bind(null, id), idleState);
  // New venues get their web address from the English name; existing ones keep theirs.
  const [slug, setSlug] = useState(defaults.slug);
  const e = state.fieldErrors ?? {};

  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div
            onChange={(event) => {
              const target = event.target as HTMLInputElement;
              if (target.name === "name.en" && !defaults.slug) setSlug(slugify(target.value));
            }}
          >
            <LocalizedField name="name" label="Title" required defaultValue={defaults.name} errors={e} />
          </div>
          <input type="hidden" name="slug" value={slug} />
          {e.slug ? <p className="text-sm text-danger">{e.slug}</p> : null}
          <LocalizedField name="description" label="Description" multiline rows={5} defaultValue={defaults.description} errors={e} />
          <MediaMultiPicker
            ownOnly
            name="imageIds"
            label="Photos (click in the order to show them)"
            hint="Best: landscape 1600×1200 or larger. Upload as many as you like."
            options={images}
            defaultValue={defaults.imageIds}
            error={e.media}
            preview="tile"
            upload={{ enabled: uploads, group: "halls", kind: "image", alt: "The Sundaram Palace venue" }}
          />
          <div className="flex flex-wrap items-end gap-6">
            <CheckboxField name="published" label="Show on the website" defaultChecked={defaults.published} />
            <TextField name="sortOrder" label="Order on the page" type="number" min={0} defaultValue={defaults.sortOrder} className="w-36" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <SubmitButton>{id ? "Save venue" : "Create venue"}</SubmitButton>
        {id ? (
          <DeleteButton
            action={deleteHallAction.bind(null, id)}
            label="Delete venue"
            title="Delete this venue?"
            description="It is removed from the website, this list and new bookings. Bookings and enquiries that already use it keep showing its name."
          >
            {defaults.imageIds.length ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="deletePhotos" defaultChecked className="mt-0.5 size-4 accent-primary" />
                <span>
                  Also delete its {defaults.imageIds.length} photo{defaults.imageIds.length === 1 ? "" : "s"} from the media library and Cloudinary
                  <span className="block text-xs text-text-muted">Photos used on another page are kept.</span>
                </span>
              </label>
            ) : null}
          </DeleteButton>
        ) : null}
      </div>
    </ActionForm>
  );
}
