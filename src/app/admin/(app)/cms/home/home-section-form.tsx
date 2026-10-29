"use client";

import { Images, Video } from "lucide-react";
import { useActionState, useState } from "react";

import {
  MediaMultiPicker,
  MediaPicker,
  type MediaOption,
} from "@/components/cms/media-picker";
import {
  ActionForm,
  ActionFeedback,
  CheckboxField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/forms/form-kit";
import type { Localized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import { saveHomeSectionAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

type Defaults = {
  heading: Localized | null;
  intro: Localized | null;
  subheading: Localized | null;
  heroMedia: "images" | "video";
  slideAssetIds: string[];
  videoAssetId: string | null;
  videoPath: string;
  posterAssetId: string | null;
  pictureAssetIds: string[];
  visible: boolean;
};

const TITLES: Record<string, string> = {
  hero: "Hero",
  intro: "Welcome",
  venues: "Venues",
  services: "Celebrations",
  catering: "Catering",
  decor: "Décor",
  gallery: "Gallery",
  reviews: "Testimonials and reviews",
  contact: "Contact",
};

/** Plain-words labels for each section's two text boxes (what visitors see). */
const TEXT_LABELS: Record<
  string,
  {
    title: string;
    titleHint: string;
    line: string;
    lineHint: string;
    multiline?: boolean;
  }
> = {
  hero: {
    title: "Big title in the middle",
    titleHint: "Leave empty to show “The Sundaram Palace”.",
    line: "Line under the big title (optional)",
    lineHint: "One short sentence.",
  },
  intro: {
    title: "Welcome title",
    titleHint: "e.g. “Welcome to The Sundaram Palace”.",
    line: "Welcome text",
    lineHint:
      "A few sentences. This section only appears on the homepage when this has text.",
    multiline: true,
  },
};
const DEFAULT_LABELS = {
  title: "Section title",
  titleHint: "The heading visitors see above this section.",
  line: "Line under the title (optional)",
  lineHint: "One or two sentences under the heading.",
  multiline: true,
};

/** One text box in English, with its Hindi box shown only when Hindi is switched on. */
function SectionText({
  name,
  label,
  hint,
  multiline,
  defaultValue,
  hindi,
  errors,
}: {
  name: string;
  label: string;
  hint: string;
  multiline?: boolean;
  defaultValue: Localized | null;
  hindi: boolean;
  errors: Record<string, string>;
}) {
  const Control = multiline ? TextAreaField : TextField;
  return (
    <div className="space-y-3">
      <Control
        name={`${name}.en`}
        label={label}
        hint={hint}
        defaultValue={defaultValue?.en ?? ""}
        error={errors[`${name}.en`]}
        {...(multiline ? { rows: 3 } : {})}
      />
      {/* Kept in the form when hidden, so saving never wipes existing Hindi text. */}
      <div className={hindi ? undefined : "hidden"}>
        <Control
          name={`${name}.hi`}
          lang="hi"
          label={`${label.replace(" (optional)", "")} — हिन्दी`}
          defaultValue={defaultValue?.hi ?? ""}
          {...(multiline ? { rows: 3 } : {})}
        />
      </div>
    </div>
  );
}

/** Sections that show a left/right picture carousel (matches PICTURE_SECTIONS on the server). */
const PICTURE_SECTIONS = ["venues", "services", "catering"];

function HeroMediaFields({
  defaults,
  images,
  videos,
  errors,
  uploads,
}: {
  defaults: Defaults;
  images: MediaOption[];
  videos: MediaOption[];
  errors: Record<string, string>;
  uploads: boolean;
}) {
  const [mode, setMode] = useState(defaults.heroMedia);
  const choices = [
    {
      value: "images",
      label: "Image slideshow",
      hint: "Several photos that change on their own",
      icon: Images,
    },
    {
      value: "video",
      label: "Video",
      hint: "One muted film that plays on a loop",
      icon: Video,
    },
  ] as const;
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Hero background</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {choices.map((c) => (
            <label
              key={c.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors",
                mode === c.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50",
              )}
            >
              <input
                type="radio"
                name="heroMedia"
                value={c.value}
                checked={mode === c.value}
                onChange={() => setMode(c.value)}
                className="sr-only"
              />
              <c.icon
                className={cn(
                  "mt-0.5 size-5 shrink-0",
                  mode === c.value ? "text-primary" : "text-text-muted",
                )}
                aria-hidden="true"
              />
              <span>
                <span className="block font-medium">{c.label}</span>
                <span className="block text-sm text-text-muted">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Both groups stay in the form so switching back keeps the choices. */}
      <div className={cn(mode !== "images" && "hidden")}>
        <MediaMultiPicker
          name="slideAssetIds"
          label="Slideshow photos (click in the order to show them)"
          hint="Best: landscape 1920×1080 or larger (16:9), subject in the centre. 3–6 photos work well."
          options={images}
          defaultValue={defaults.slideAssetIds}
          error={errors.slideAssetIds}
          preview="hero"
          upload={{
            enabled: uploads,
            group: "hero",
            kind: "image",
            alt: "The Sundaram Palace",
          }}
          ownOnly
        />
      </div>
      <div className={cn("space-y-5", mode !== "video" && "hidden")}>
        <MediaPicker
          name="videoAssetId"
          label="Video"
          options={videos}
          defaultValue={defaults.videoAssetId}
          hint="One video plays on a loop, without sound. Upload a new one to replace it, or Delete to remove it. Best: landscape 1920×1080 (16:9), 15–30 seconds, MP4 or iPhone MOV, up to 50 MB. Keep the main subject in the centre — phones show only the middle."
          error={errors.videoAssetId}
          upload={{
            enabled: uploads,
            group: "hero",
            kind: "video",
            alt: "The Sundaram Palace venue film",
          }}
          ownOnly
        />
        <MediaPicker
          name="posterAssetId"
          label="Poster image (shown while the video loads, and to visitors with Data Saver on)"
          options={images}
          defaultValue={defaults.posterAssetId}
          preview="hero"
          upload={{
            enabled: uploads,
            group: "hero",
            kind: "image",
            alt: "The Sundaram Palace",
          }}
          ownOnly
        />
        {defaults.videoPath ? (
          <TextField
            name="videoPath"
            label="Older video file path"
            defaultValue={defaults.videoPath}
            hint="Used only when no video is chosen above. Clear it once a video is uploaded."
            error={errors.videoPath}
          />
        ) : null}
      </div>
    </div>
  );
}

export function HomeSectionForm({
  type,
  description,
  defaults,
  images,
  videos,
  uploads,
}: {
  type: string;
  description: string;
  defaults: Defaults;
  images: MediaOption[];
  videos: MediaOption[];
  /** Cloudinary is connected, so pickers can upload directly. */
  uploads: boolean;
}) {
  const [state, action] = useActionState(
    saveHomeSectionAction.bind(null, type),
    idleState,
  );
  const e = state.fieldErrors ?? {};
  const labels = TEXT_LABELS[type] ?? DEFAULT_LABELS;
  const titleField = "heading";
  const lineField = type === "hero" ? "subheading" : "intro";
  const [hindi, setHindi] = useState(
    Boolean(
      defaults.heading?.hi || defaults.intro?.hi || defaults.subheading?.hi,
    ),
  );
  return (
    <details
      className="group rounded-lg border border-border bg-surface"
      open={type === "hero"}
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 p-4">
        <span>
          <span className="font-medium">{TITLES[type] ?? type}</span>
          <span className="block text-sm text-text-muted">{description}</span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
            defaults.visible
              ? "bg-success/10 text-success"
              : "bg-text-muted/10 text-text-muted",
          )}
        >
          {defaults.visible ? "On homepage" : "Hidden"}
        </span>
      </summary>
      <ActionForm
        action={action}
        className="space-y-5 border-t border-border p-4"
      >
        <ActionFeedback state={state} />
        <SectionText
          name={titleField}
          label={labels.title}
          hint={labels.titleHint}
          defaultValue={defaults.heading}
          hindi={hindi}
          errors={e}
        />
        <SectionText
          name={lineField}
          label={labels.line}
          hint={labels.lineHint}
          multiline={labels.multiline}
          defaultValue={type === "hero" ? defaults.subheading : defaults.intro}
          hindi={hindi}
          errors={e}
        />
        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={hindi}
            onChange={(event) => setHindi(event.target.checked)}
            className="size-4 accent-primary"
          />
          Also write this in Hindi (shown to visitors who switch to हिन्दी;
          otherwise they see the English)
        </label>
        {type === "hero" ? (
          <HeroMediaFields
            defaults={defaults}
            images={images}
            videos={videos}
            errors={e}
            uploads={uploads}
          />
        ) : null}
        {PICTURE_SECTIONS.includes(type) ? (
          <MediaMultiPicker
            name="pictureAssetIds"
            label="Pictures (visitors move through them with left/right arrows)"
            hint="Best: landscape 1600×1200 (4:3) or larger."
            options={images}
            defaultValue={defaults.pictureAssetIds}
            error={e.pictureAssetIds}
            preview="tile"
            upload={{
              enabled: uploads,
              group:
                type === "venues"
                  ? "halls"
                  : type === "catering"
                    ? "catering"
                    : "celebrations",
              kind: "image",
              alt: `The Sundaram Palace — ${TITLES[type] ?? type}`,
            }}
          />
        ) : null}
        <CheckboxField
          name="visible"
          label="Show on homepage"
          defaultChecked={defaults.visible}
        />
        <SubmitButton size="sm">Save section</SubmitButton>
      </ActionForm>
    </details>
  );
}
