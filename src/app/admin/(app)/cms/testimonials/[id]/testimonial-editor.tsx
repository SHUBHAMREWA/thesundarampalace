"use client";

import { Star } from "lucide-react";
import { useActionState, useState } from "react";

import { DeleteButton } from "@/components/cms/delete-button";
import { MediaPicker, type MediaOption } from "@/components/cms/media-picker";
import { ActionFeedback, ActionForm, CheckboxField, LocalizedField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { Card, CardContent } from "@/components/ui/card";
import type { Localized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import { deleteTestimonialAction, saveTestimonialAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

type Defaults = {
  name: string;
  event: Localized | null;
  quote: Localized | null;
  rating: number;
  photoAssetId: string | null;
  consent: boolean;
  published: boolean;
};

/** Five clickable stars; sends the chosen number as `name`. */
function StarRating({ name, defaultValue, error }: { name: string; defaultValue: number; error?: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <fieldset>
      <legend className="text-sm font-medium">Star rating</legend>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => setValue(n)} className="sr-only" />
            <Star className={cn("size-8 transition-colors", n <= value ? "fill-gold text-gold" : "text-border hover:text-gold/60")} aria-hidden="true" />
            <span className="sr-only">
              {n} star{n === 1 ? "" : "s"}
            </span>
          </label>
        ))}
        <span className="ml-2 text-sm text-text-muted">{value} of 5</span>
      </div>
      {error ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}

export function TestimonialEditor({ id, defaults, media, uploads }: { id: string | null; defaults: Defaults; media: MediaOption[]; uploads: boolean }) {
  const [state, action] = useActionState(saveTestimonialAction.bind(null, id), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardContent className="space-y-6 pt-6">
          <TextField
            name="name"
            label="Guest name"
            required
            maxLength={120}
            defaultValue={defaults.name}
            error={e.name}
            hint="As the guest wants it shown, e.g. “Priya & Rahul Sharma”."
          />
          <LocalizedField name="event" label="Event and date (optional)" defaultValue={defaults.event} errors={e} hint="e.g. Wedding, December 2025" />
          <LocalizedField name="quote" label="What they said" required multiline rows={4} defaultValue={defaults.quote} errors={e} hint="Their own words. Don't rewrite or add to them." />
          <StarRating name="rating" defaultValue={defaults.rating} error={e.rating} />
          <MediaPicker
            ownOnly
            name="photoAssetId"
            label="Guest photo (optional)"
            hint="Without a photo the card shows their initials."
            options={media}
            defaultValue={defaults.photoAssetId}
            error={e.media}
            preview="avatar"
            upload={{ enabled: uploads, group: "testimonials", kind: "image", alt: `${defaults.name || "Guest"} at The Sundaram Palace` }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <CheckboxField
            name="consent"
            label="The guest agreed to show this review (and photo) on the website"
            defaultChecked={defaults.consent}
            hint="Required before it can be shown. Only real reviews — never write one yourself."
          />
          {e.consent ? <p className="text-sm text-danger">{e.consent}</p> : null}
          <CheckboxField name="published" label="Show on the website" defaultChecked={defaults.published} />
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <SubmitButton>{id ? "Save testimonial" : "Add testimonial"}</SubmitButton>
        {id ? (
          <DeleteButton
            action={deleteTestimonialAction.bind(null, id)}
            title="Delete this testimonial?"
            description="It disappears from the website, and the guest's photo is deleted from Cloudinary."
          />
        ) : null}
      </div>
    </ActionForm>
  );
}
