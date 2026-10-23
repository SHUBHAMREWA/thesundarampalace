"use client";

import { useActionState } from "react";

import { DeleteButton } from "@/components/cms/delete-button";
import { MediaPicker, type MediaOption } from "@/components/cms/media-picker";
import {
  ActionForm,
  ActionFeedback,
  CheckboxField,
  LocalizedField,
  RICH_TEXT_HINT,
  SubmitButton,
  TextField,
} from "@/components/forms/form-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Localized } from "@/lib/i18n/localized";
import { deleteServicePageAction, savePageAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

type Defaults = {
  title: Localized;
  summary: Localized | null;
  body: Localized | null;
  heroAssetId: string | null;
  seoTitle: Localized | null;
  seoDescription: Localized | null;
  published: boolean;
  sortOrder: number;
};

export function PageEditor({ id, kind, defaults, media }: { id: string; kind: string; defaults: Defaults; media: MediaOption[] }) {
  const [state, action] = useActionState(savePageAction.bind(null, id), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardHeader><CardTitle>Content</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <LocalizedField name="title" label="Title" required defaultValue={defaults.title} errors={e} />
          <LocalizedField
            name="summary"
            label="Introduction"
            multiline
            rows={2}
            defaultValue={defaults.summary}
            errors={e}
            hint="One or two sentences shown under the title and used as the search description if none is set below."
          />
          <LocalizedField
            name="body"
            label={kind === "LEGAL" ? "Policy text (must be professionally reviewed)" : "Body"}
            multiline
            rows={12}
            defaultValue={defaults.body}
            errors={e}
            hint={RICH_TEXT_HINT}
          />
          <MediaPicker name="heroAssetId" label="Header image" options={media} defaultValue={defaults.heroAssetId} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Search engines and sharing</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <LocalizedField name="seo.title" label="SEO title (optional)" defaultValue={defaults.seoTitle} errors={e} hint="Defaults to the page title. Aim for under 60 characters." />
          <LocalizedField name="seo.description" label="SEO description (optional)" multiline rows={2} defaultValue={defaults.seoDescription} errors={e} hint="Defaults to the introduction. Aim for under 160 characters." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Publishing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <CheckboxField name="published" label="Published" defaultChecked={defaults.published} hint="Unpublished pages return “page not found” on the website." />
          <TextField name="sortOrder" label="Sort order" type="number" min={0} defaultValue={defaults.sortOrder} className="max-w-40" />
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <SubmitButton>Save page</SubmitButton>
        {kind === "SERVICE" ? (
          <DeleteButton
            action={deleteServicePageAction.bind(null, id)}
            title="Delete this service page?"
            description="It will disappear from the website straight away."
          />
        ) : null}
      </div>
    </ActionForm>
  );
}
