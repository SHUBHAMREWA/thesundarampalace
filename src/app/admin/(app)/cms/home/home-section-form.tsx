"use client";

import { useActionState } from "react";

import { MediaPicker, type MediaOption } from "@/components/cms/media-picker";
import { ActionForm, ActionFeedback, CheckboxField, LocalizedField, SubmitButton, TextField } from "@/components/forms/form-kit";
import type { Localized } from "@/lib/i18n/localized";
import { saveHomeSectionAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

type Defaults = {
  heading: Localized | null;
  intro: Localized | null;
  subheading: Localized | null;
  videoPath: string;
  posterAssetId: string | null;
  visible: boolean;
  sortOrder: number;
};

const TITLES: Record<string, string> = {
  hero: "Hero",
  intro: "Welcome",
  venues: "Venues",
  services: "Celebrations",
  catering: "Catering",
  decor: "Décor",
  packages: "Packages",
  gallery: "Gallery",
  reviews: "Reviews",
  dates: "Popular dates",
  contact: "Contact",
};

export function HomeSectionForm({
  type,
  description,
  defaults,
  media,
}: {
  type: string;
  description: string;
  defaults: Defaults;
  media: MediaOption[];
}) {
  const [state, action] = useActionState(saveHomeSectionAction.bind(null, type), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <details className="group rounded-lg border border-border bg-surface" open={type === "hero"}>
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
        <span>
          <span className="font-medium">{TITLES[type] ?? type}</span>
          <span className="block text-sm text-text-muted">{description}</span>
        </span>
        <span className="text-sm text-text-muted">{defaults.visible ? "Visible" : "Hidden"} · #{defaults.sortOrder}</span>
      </summary>
      <ActionForm action={action} className="space-y-5 border-t border-border p-4">
        <ActionFeedback state={state} />
        <LocalizedField name="heading" label={type === "hero" ? "Headline" : "Heading"} defaultValue={defaults.heading} errors={e} />
        {type === "hero" ? (
          <>
            <LocalizedField name="subheading" label="Sub-headline" defaultValue={defaults.subheading} errors={e} />
            <MediaPicker name="posterAssetId" label="Poster image (also shown when video is off)" options={media} defaultValue={defaults.posterAssetId} />
            <TextField
              name="videoPath"
              label="Venue film file (optional)"
              placeholder="/media/hero.mp4"
              defaultValue={defaults.videoPath}
              hint="Compressed (≤ 3 MB), muted MP4/WebM placed in public/media/ by the developer, to save Cloudinary credits."
              error={e.videoPath}
            />
          </>
        ) : (
          <LocalizedField name="intro" label="Introduction" multiline rows={3} defaultValue={defaults.intro} errors={e} />
        )}
        <div className="flex flex-wrap items-end gap-6">
          <CheckboxField name="visible" label="Show on homepage" defaultChecked={defaults.visible} />
          <TextField name="sortOrder" label="Sort order" type="number" min={0} defaultValue={defaults.sortOrder} className="w-32" />
        </div>
        <SubmitButton size="sm">Save section</SubmitButton>
      </ActionForm>
    </details>
  );
}
