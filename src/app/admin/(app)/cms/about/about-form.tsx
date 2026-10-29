"use client";

import { useActionState } from "react";

import { MediaPicker, type MediaOption } from "@/components/cms/media-picker";
import { ActionFeedback, ActionForm, SubmitButton } from "@/components/forms/form-kit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { saveAboutPhotosAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

export function AboutPhotosForm({
  media,
  uploads,
  defaults,
}: {
  media: MediaOption[];
  uploads: boolean;
  defaults: { headerAssetId: string | null; ownerAssetId: string | null };
}) {
  const [state, action] = useActionState(saveAboutPhotosAction, idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardHeader>
          <CardTitle>Header photo</CardTitle>
          <CardDescription>Shown behind the “About us” title at the top of the page, under a dark tint so the title stays readable.</CardDescription>
        </CardHeader>
        <CardContent>
          <MediaPicker
            name="headerAssetId"
            label="Photo"
            hint="Best: landscape 2400×1000 or larger. Keep the main subject in the centre — phones show a squarer crop."
            options={media}
            defaultValue={defaults.headerAssetId}
            error={e.media}
            preview="banner"
            upload={{ enabled: uploads, group: "about", kind: "image", alt: "The Sundaram Palace, Rewa" }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Owner photo</CardTitle>
          <CardDescription>Shown beside Mr. Vivek Garg’s message in a gold portrait frame. Without a photo the frame shows his initials.</CardDescription>
        </CardHeader>
        <CardContent>
          <MediaPicker
            name="ownerAssetId"
            label="Photo"
            hint="Best: portrait 1200×1500 (4:5) or larger, face in the upper half."
            options={media}
            defaultValue={defaults.ownerAssetId}
            preview="portrait"
            upload={{ enabled: uploads, group: "about", kind: "image", alt: "Mr. Vivek Garg, owner of The Sundaram Palace" }}
          />
        </CardContent>
      </Card>
      <p className="text-sm text-text-muted">
        Photos are converted to WebP and stored in Cloudinary. When you replace a photo and save, the old one is deleted from Cloudinary too
        (unless another page uses it).
      </p>
      <SubmitButton>Save photos</SubmitButton>
    </ActionForm>
  );
}
