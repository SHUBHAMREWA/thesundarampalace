"use client";

import { ExternalLink, Search } from "lucide-react";
import { useActionState, useState } from "react";

import { DeleteButton } from "@/components/cms/delete-button";
import { MediaPicker, type MediaOption } from "@/components/cms/media-picker";
import { ActionFeedback, ActionForm, CheckboxField, LocalizedField, RICH_TEXT_HINT, SelectField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { excerpt } from "@/lib/content/excerpt";
import type { Localized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils";
import { deleteBlogPostAction, saveBlogPostAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

type Defaults = {
  title: Localized | null;
  slug: string;
  summary: Localized | null;
  content: Localized | null;
  coverAssetId: string | null;
  categoryKey: string;
  tags: string;
  author: string;
  seoTitle: Localized | null;
  seoDescription: Localized | null;
  published: boolean;
};

const SITE = "thesundarampalace.com";

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

/** Character count that turns amber when Google would cut the text. */
function Counter({ length, max }: { length: number; max: number }) {
  return <span className={cn("text-xs tabular-nums", length > max ? "text-warning" : "text-text-muted")}>{length} / {max}</span>;
}

/** Write or edit a blog post: the article, its cover photo, and how it shows on Google. */
export function BlogEditor({
  id,
  defaults,
  media,
  categories,
  uploads,
}: {
  id: string | null;
  defaults: Defaults;
  media: MediaOption[];
  categories: { value: string; label: string }[];
  uploads: boolean;
}) {
  const [state, action] = useActionState(saveBlogPostAction.bind(null, id), idleState);
  const e = state.fieldErrors ?? {};
  // English text, kept in step with the fields for the web address and the Google preview.
  const [text, setText] = useState({
    title: defaults.title?.en ?? "",
    summary: defaults.summary?.en ?? "",
    content: defaults.content?.en ?? "",
    seoTitle: defaults.seoTitle?.en ?? "",
    seoDescription: defaults.seoDescription?.en ?? "",
  });
  const [slug, setSlug] = useState(defaults.slug);
  // A new post's address follows its title until it is edited by hand; a saved post keeps its address.
  const [slugTouched, setSlugTouched] = useState(Boolean(defaults.slug));

  const googleTitle = text.seoTitle || text.title || "Post title";
  const googleDescription = text.seoDescription || text.summary || excerpt(text.content) || "The summary, or the opening of the article, appears here.";
  const shownSlug = slug || slugify(text.title) || "post-address";

  return (
    <ActionForm
      action={action}
      className="space-y-6"
      onChange={(event) => {
        const { name, value } = event.target as EventTarget as HTMLInputElement;
        const key = { "title.en": "title", "summary.en": "summary", "content.en": "content", "seo.title.en": "seoTitle", "seo.description.en": "seoDescription" }[name];
        if (key) setText((s) => ({ ...s, [key]: value }));
        if (name === "title.en" && !slugTouched) setSlug(slugify(value));
      }}
    >
      <ActionFeedback state={state} />
      <Card>
        <CardHeader>
          <CardTitle>Article</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <LocalizedField name="title" label="Title" required defaultValue={defaults.title} errors={e} hint="The heading readers see, e.g. “How to plan a sangeet night”." />
          <div className="space-y-1.5">
            <TextField
              name="slug"
              label="Web address"
              value={slug}
              onChange={(event) => {
                setSlug(slugify(event.target.value) + (event.target.value.endsWith("-") ? "-" : ""));
                setSlugTouched(true);
              }}
              placeholder="Made from the title"
              error={e.slug}
              hint={
                defaults.published
                  ? "This post is live: changing its address breaks links people have already shared."
                  : "Made from the title as you type. Short addresses with the main words work best on Google."
              }
            />
            <p className="truncate text-sm text-text-muted">
              {SITE}/blog/<span className="font-medium text-primary">{shownSlug}</span>
            </p>
          </div>
          <LocalizedField
            name="summary"
            label="Short summary"
            multiline
            rows={2}
            defaultValue={defaults.summary}
            errors={e}
            hint="One or two sentences under the title, on the blog list and in WhatsApp/Facebook shares. If empty, the opening of the article is used."
          />
          <LocalizedField name="content" label="Article text" required multiline rows={18} defaultValue={defaults.content} errors={e} hint={RICH_TEXT_HINT} />
          <MediaPicker
            name="coverAssetId"
            label="Cover photo"
            options={media}
            defaultValue={defaults.coverAssetId}
            error={e.coverAssetId}
            hint="Shown on the blog list, at the top of the article and in shares."
            preview="wide"
            upload={{ enabled: uploads, group: "other", kind: "image", alt: text.title || "The Sundaram Palace blog" }}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField name="categoryKey" label="Category" options={categories} defaultValue={defaults.categoryKey} placeholder="Choose…" error={e.categoryKey} />
            <TextField name="tags" label="Tags (optional)" defaultValue={defaults.tags} placeholder="haldi, décor, monsoon wedding" hint="Separate with commas." />
            <TextField name="author" label="Author" defaultValue={defaults.author} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-4 text-text-muted" aria-hidden="true" /> How it looks on Google
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border bg-surface p-4" aria-label="Google result preview">
            <p className="truncate text-xs text-text-muted">{SITE} › blog › {shownSlug}</p>
            <p className="mt-1 line-clamp-1 text-lg text-info">{googleTitle} · The Sundaram Palace</p>
            <p className="mt-1 line-clamp-2 text-sm text-text-muted">{googleDescription}</p>
          </div>
          <details className="group" open={Boolean(defaults.seoTitle || defaults.seoDescription)}>
            <summary className="cursor-pointer text-sm font-medium text-primary">Write a different Google title or description (optional)</summary>
            <div className="mt-4 space-y-5">
              <div>
                <LocalizedField name="seo.title" label="Google title" defaultValue={defaults.seoTitle} errors={e} hint="Main search words first, e.g. “Haldi decoration ideas in Rewa”." />
                <Counter length={text.seoTitle.length} max={60} />
              </div>
              <div>
                <LocalizedField name="seo.description" label="Google description" multiline rows={2} defaultValue={defaults.seoDescription} errors={e} hint="The grey text under the link." />
                <Counter length={text.seoDescription.length} max={160} />
              </div>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <CheckboxField name="published" label="Published (visible on the website)" defaultChecked={defaults.published} />
          {id && defaults.published && defaults.slug ? (
            <a href={`/en/blog/${defaults.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              View on website <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <SubmitButton>{id ? "Save post" : "Create post"}</SubmitButton>
        {id ? <DeleteButton action={deleteBlogPostAction.bind(null, id)} title="Delete this post?" description="It disappears from the website straight away. Its photo stays in the media library." /> : null}
      </div>
    </ActionForm>
  );
}
