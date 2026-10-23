"use client";

import { useActionState, useState } from "react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FACILITY_KEYS, HALL_LAYOUTS } from "@/lib/content/catalog";
import type { Localized } from "@/lib/i18n/localized";
import { deleteHallAction, saveHallAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

import en from "@messages/en.json";

export type HallDefaults = {
  name: Localized | null;
  slug: string;
  summary: Localized | null;
  description: Localized | null;
  areaSqFt: string;
  ceilingHeightFt: string;
  capacities: Record<string, { min: string; max: string }>;
  facilities: Record<string, string>;
  eventTypeKeys: string[];
  slotsInfo: Localized | null;
  heroAssetId: string | null;
  floorPlanAssetId: string | null;
  imageIds: string[];
  tourUrl: string;
  seoTitle: Localized | null;
  seoDescription: Localized | null;
  published: boolean;
  sortOrder: number;
};

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function HallEditor({
  id,
  defaults,
  media,
  eventTypes,
}: {
  id: string | null;
  defaults: HallDefaults;
  media: MediaOption[];
  eventTypes: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(saveHallAction.bind(null, id), idleState);
  const [slug, setSlug] = useState(defaults.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(defaults.slug));
  const e = state.fieldErrors ?? {};
  const images = media.filter((m) => m.resourceType === "image");

  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div onChange={(event) => {
            const target = event.target as HTMLInputElement;
            if (target.name === "name.en" && !slugTouched) setSlug(slugify(target.value));
          }}>
            <LocalizedField name="name" label="Name" required defaultValue={defaults.name} errors={e} />
          </div>
          <TextField
            name="slug"
            label="Web address"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            hint={`Shown as /venues/${slug || "…"}`}
            error={e.slug}
          />
          <LocalizedField name="summary" label="Short summary" multiline rows={2} defaultValue={defaults.summary} errors={e} />
          <LocalizedField name="description" label="Description" multiline rows={8} defaultValue={defaults.description} errors={e} hint={RICH_TEXT_HINT} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verified facts</CardTitle>
          <p className="text-sm text-text-muted">Leave blank anything the business hasn&apos;t confirmed.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="areaSqFt" label="Area (sq ft)" inputMode="numeric" defaultValue={defaults.areaSqFt} error={e.areaSqFt} />
            <TextField name="ceilingHeightFt" label="Ceiling height (ft)" inputMode="decimal" defaultValue={defaults.ceilingHeightFt} error={e.ceilingHeightFt} />
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Capacity by seating layout (guests)</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {HALL_LAYOUTS.map((layout, index) => (
                <div key={layout} className="rounded-md border border-border p-3">
                  <p className="text-sm">{en.catalog.layout[layout]}</p>
                  <div className="mt-2 flex gap-2">
                    <label className="flex-1 text-xs text-text-muted">
                      Minimum
                      <Input name={`capacity.${layout}.min`} inputMode="numeric" defaultValue={defaults.capacities[layout]?.min ?? ""} className="mt-1 bg-surface" />
                    </label>
                    <label className="flex-1 text-xs text-text-muted">
                      Maximum
                      <Input name={`capacity.${layout}.max`} inputMode="numeric" defaultValue={defaults.capacities[layout]?.max ?? ""} className="mt-1 bg-surface" />
                    </label>
                  </div>
                  {e[`capacities.${index}`] || e[`capacities.${index}.minGuests`] || e[`capacities.${index}.maxGuests`] ? (
                    <p className="mt-1 text-sm text-danger">
                      {e[`capacities.${index}`] ?? e[`capacities.${index}.minGuests`] ?? e[`capacities.${index}.maxGuests`]}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Facilities</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {FACILITY_KEYS.map((key) => (
                <div key={key} className="flex items-center gap-3">
                  <input
                    id={`facility-${key}`}
                    type="checkbox"
                    name={`facility.${key}`}
                    defaultChecked={key in defaults.facilities}
                    className="size-4 accent-primary"
                  />
                  <label htmlFor={`facility-${key}`} className="w-40 text-sm">{en.catalog.facility[key]}</label>
                  <Input
                    name={`facility.${key}.note`}
                    placeholder="Note (optional)"
                    aria-label={`${en.catalog.facility[key]} note`}
                    defaultValue={defaults.facilities[key] ?? ""}
                    className="h-8 bg-surface text-sm"
                  />
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium">Suitable for</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {eventTypes.map((type) => (
                <label key={type.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="eventTypeKeys" value={type.value} defaultChecked={defaults.eventTypeKeys.includes(type.value)} className="size-4 accent-primary" />
                  {type.label}
                </label>
              ))}
            </div>
          </fieldset>
          <LocalizedField
            name="slotsInfo"
            label="Event timings (shown as information)"
            multiline
            rows={3}
            defaultValue={defaults.slotsInfo}
            errors={e}
            hint="e.g. “- Morning: 08:00–15:00”. Booking slots themselves are configured in Phase 3."
          />
          <TextField name="tourUrl" label="360° tour or walkthrough video link (optional)" type="url" defaultValue={defaults.tourUrl} error={e.tourUrl} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Photographs</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {e.media ? <p className="text-sm text-danger">{e.media}</p> : null}
          <MediaPicker name="heroAssetId" label="Main photo" options={images} defaultValue={defaults.heroAssetId} />
          <MediaPicker name="floorPlanAssetId" label="Floor plan" options={images} defaultValue={defaults.floorPlanAssetId} />
          <MediaMultiPicker name="imageIds" label="More photos (click in the order to show them)" options={images} defaultValue={defaults.imageIds} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Search engines and publishing</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <LocalizedField name="seo.title" label="SEO title (optional)" defaultValue={defaults.seoTitle} errors={e} />
          <LocalizedField name="seo.description" label="SEO description (optional)" multiline rows={2} defaultValue={defaults.seoDescription} errors={e} />
          <div className="flex flex-wrap items-end gap-6">
            <CheckboxField name="published" label="Published on the website" defaultChecked={defaults.published} />
            <TextField name="sortOrder" label="Sort order" type="number" min={0} defaultValue={defaults.sortOrder} className="w-32" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <SubmitButton>{id ? "Save venue" : "Create venue"}</SubmitButton>
        {id ? (
          <DeleteButton
            action={deleteHallAction.bind(null, id)}
            title="Delete this venue?"
            description="It is removed from the website. Leads that mention it keep their history but lose the link."
          />
        ) : null}
      </div>
    </ActionForm>
  );
}
