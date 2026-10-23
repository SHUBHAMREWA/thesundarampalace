"use client";

import { useActionState } from "react";

import { DeleteButton } from "@/components/cms/delete-button";
import { MediaMultiPicker, type MediaOption } from "@/components/cms/media-picker";
import { ActionForm, ActionFeedback, CheckboxField, LocalizedField, RICH_TEXT_HINT, SubmitButton, TextField } from "@/components/forms/form-kit";
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

export function DecorEditor({ id, defaults, media }: { id: string | null; defaults: Defaults; media: MediaOption[] }) {
  const [state, action] = useActionState(saveDecorAction.bind(null, id), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardContent className="space-y-5 pt-6">
          <LocalizedField name="name" label="Theme name" required defaultValue={defaults.name} errors={e} />
          <TextField name="slug" label="Short address" defaultValue={defaults.slug} placeholder="e.g. royal-floral" hint="Lowercase letters, numbers and hyphens." error={e.slug} />
          <LocalizedField name="description" label="Description" multiline rows={4} defaultValue={defaults.description} errors={e} hint={RICH_TEXT_HINT} />
          {e.media ? <p className="text-sm text-danger">{e.media}</p> : null}
          <MediaMultiPicker name="imageIds" label="Photos (first one is the cover)" options={media} defaultValue={defaults.imageIds} />
          <div className="flex flex-wrap items-end gap-6">
            <CheckboxField name="published" label="Published" defaultChecked={defaults.published} />
            <TextField name="sortOrder" label="Sort order" type="number" min={0} defaultValue={defaults.sortOrder} className="w-32" />
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
