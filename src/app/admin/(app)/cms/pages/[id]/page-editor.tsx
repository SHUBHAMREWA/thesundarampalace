"use client";

import Link from "next/link";
import { useActionState } from "react";

import { DeleteButton } from "@/components/cms/delete-button";
import { MediaMultiPicker, MediaPicker, type MediaOption } from "@/components/cms/media-picker";
import {
  ActionForm,
  ActionFeedback,
  CheckboxField,
  LocalizedField,
  RICH_TEXT_HINT,
  SubmitButton,
  TextField,
} from "@/components/forms/form-kit";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  imageIds: string[];
  published: boolean;
  sortOrder: number;
};

/** Celebrations: just a title, a description and photos, shown one below the other on /services. */
function CelebrationForm({ id, defaults, media, uploads }: { id: string; defaults: Defaults; media: MediaOption[]; uploads: boolean }) {
  const [state, action] = useActionState(savePageAction.bind(null, id), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardContent className="space-y-6 pt-6">
          <LocalizedField name="title" label="Title" required defaultValue={defaults.title} errors={e} />
          <LocalizedField name="body" label="Description" multiline rows={5} defaultValue={defaults.body} errors={e} />
          <MediaMultiPicker
            ownOnly
            name="imageIds"
            label="Photos (click in the order to show them)"
            hint="Best: landscape 1600×1200 or larger. Upload as many as you like."
            options={media}
            defaultValue={defaults.imageIds}
            error={e.media}
            preview="tile"
            upload={{ enabled: uploads, group: "celebrations", kind: "image", alt: `The Sundaram Palace — ${defaults.title.en}` }}
          />
          <div className="flex flex-wrap items-end gap-6">
            <CheckboxField name="published" label="Show on the website" defaultChecked={defaults.published} />
            <TextField name="sortOrder" label="Order on the page" type="number" min={0} defaultValue={defaults.sortOrder} className="w-36" />
          </div>
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <SubmitButton>Save celebration</SubmitButton>
        <DeleteButton
          action={deleteServicePageAction.bind(null, id)}
          title="Delete this celebration?"
          description="It will disappear from the website straight away."
        />
      </div>
    </ActionForm>
  );
}

export function PageEditor({
  id,
  kind,
  slug,
  defaults,
  media,
  uploads,
}: {
  id: string;
  kind: string;
  slug: string;
  defaults: Defaults;
  media: MediaOption[];
  uploads: boolean;
}) {
  if (kind === "SERVICE") return <CelebrationForm id={id} defaults={defaults} media={media} uploads={uploads} />;
  if (kind === "STANDARD" && slug === "catering") return <CateringForm id={id} defaults={defaults} media={media} uploads={uploads} />;
  return <StandardPageForm id={id} kind={kind} defaults={defaults} media={media} uploads={uploads} />;
}

/** Catering: header photo, text and a photo gallery above the sample menus (those are edited under Menus). */
function CateringForm({ id, defaults, media, uploads }: { id: string; defaults: Defaults; media: MediaOption[]; uploads: boolean }) {
  const [state, action] = useActionState(savePageAction.bind(null, id), idleState);
  const e = state.fieldErrors ?? {};
  const upload = { enabled: uploads, group: "catering", kind: "image", alt: "The Sundaram Palace — catering" } as const;
  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardHeader>
          <CardTitle>Page text</CardTitle>
          <CardDescription>
            The menus on this page are edited under{" "}
            <Link href="/admin/cms/menus" className="text-primary underline underline-offset-4">
              Menus
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <LocalizedField name="title" label="Title" required defaultValue={defaults.title} errors={e} />
          <LocalizedField
            name="summary"
            label="Short line under the title"
            multiline
            rows={2}
            defaultValue={defaults.summary}
            errors={e}
            hint="One or two sentences. Google also shows it if no search description is set."
          />
          <LocalizedField name="body" label="Description" multiline rows={6} defaultValue={defaults.body} errors={e} hint={RICH_TEXT_HINT} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Photos</CardTitle>
          <CardDescription>Uploads are converted to WebP and stored in Cloudinary. On the website, a click opens the photo large.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <MediaPicker
            name="heroAssetId"
            label="Header photo (top of the page)"
            hint="Best: landscape 2400×1000 or larger."
            options={media}
            defaultValue={defaults.heroAssetId}
            preview="banner"
            upload={upload}
          />
          <MediaMultiPicker
            ownOnly
            name="imageIds"
            label="Food and service gallery (click in the order to show them)"
            hint="Best: landscape 1600×1200 or larger. Upload as many as you like."
            options={media}
            defaultValue={defaults.imageIds}
            error={e.media}
            preview="tile"
            upload={upload}
          />
        </CardContent>
      </Card>
      <details className="rounded-lg border border-border bg-surface p-5">
        <summary className="cursor-pointer text-sm font-medium">Google search text (optional)</summary>
        <div className="mt-5 space-y-5">
          <LocalizedField name="seo.title" label="SEO title" defaultValue={defaults.seoTitle} errors={e} hint="Defaults to the page title. Aim for under 60 characters." />
          <LocalizedField name="seo.description" label="SEO description" multiline rows={2} defaultValue={defaults.seoDescription} errors={e} hint="Defaults to the short line. Aim for under 160 characters." />
        </div>
      </details>
      <input type="hidden" name="sortOrder" value={defaults.sortOrder} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <CheckboxField name="published" label="Show on the website" defaultChecked={defaults.published} />
        <SubmitButton>Save catering page</SubmitButton>
      </div>
    </ActionForm>
  );
}

function StandardPageForm({ id, kind, defaults, media, uploads }: { id: string; kind: string; defaults: Defaults; media: MediaOption[]; uploads: boolean }) {
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
          <MediaPicker
            name="heroAssetId"
            label="Header photo (top of the page)"
            hint="Best: landscape 2400×1000 or larger. Keep the main subject in the centre — phones show a squarer crop."
            options={media}
            defaultValue={defaults.heroAssetId}
            preview="banner"
            upload={{ enabled: uploads, group: "hero", kind: "image", alt: `The Sundaram Palace — ${defaults.title.en}` }}
          />
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
          {/* Only legal pages use the order (their footer links); other pages keep theirs unchanged. */}
          {kind === "LEGAL" ? (
            <TextField name="sortOrder" label="Order in the footer" type="number" min={0} defaultValue={defaults.sortOrder} className="max-w-40" />
          ) : (
            <input type="hidden" name="sortOrder" value={defaults.sortOrder} />
          )}
        </CardContent>
      </Card>
      <SubmitButton>Save page</SubmitButton>
    </ActionForm>
  );
}
