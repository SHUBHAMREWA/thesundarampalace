"use client";

import { useActionState, useState } from "react";

import { DeleteButton } from "@/components/cms/delete-button";
import { MediaMultiPicker, type MediaOption } from "@/components/cms/media-picker";
import { ActionForm, ActionFeedback, CheckboxField, LocalizedField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { Card, CardContent } from "@/components/ui/card";
import type { Localized } from "@/lib/i18n/localized";
import { deleteDecorAction, saveDecorAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

type Defaults = {
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

/** A décor theme is a title, a description and its photos — the same as venues and celebrations. */
export function DecorEditor({ id, defaults, media, uploads }: { id: string | null; defaults: Defaults; media: MediaOption[]; uploads: boolean }) {
  const [state, action] = useActionState(saveDecorAction.bind(null, id), idleState);
  // New themes get their web address from the English name; existing ones keep theirs.
  const [slug, setSlug] = useState(defaults.slug);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardContent className="space-y-5 pt-6">
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
            hint="Upload as many as you like."
            options={media}
            defaultValue={defaults.imageIds}
            error={e.media}
            preview="tile"
            upload={{ enabled: uploads, group: "decor", kind: "image", alt: "The Sundaram Palace décor" }}
          />
          <div className="flex flex-wrap items-end gap-6">
            <CheckboxField name="published" label="Show on the website" defaultChecked={defaults.published} />
            <TextField name="sortOrder" label="Order on the page" type="number" min={0} defaultValue={defaults.sortOrder} className="w-36" />
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <SubmitButton>{id ? "Save theme" : "Create theme"}</SubmitButton>
        {id ? <DeleteButton action={deleteDecorAction.bind(null, id)} title="Delete this theme?" description="Its photos stay in the media library." /> : null}
      </div>
    </ActionForm>
  );
}
