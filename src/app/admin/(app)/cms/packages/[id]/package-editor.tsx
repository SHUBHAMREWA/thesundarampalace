"use client";

import { useActionState } from "react";

import { DeleteButton } from "@/components/cms/delete-button";
import { ActionForm, ActionFeedback, CheckboxField, LocalizedField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Localized } from "@/lib/i18n/localized";
import { deletePackageAction, savePackageAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

type Defaults = {
  name: Localized | null;
  slug: string;
  description: Localized | null;
  inclusions: Localized | null;
  addOns: Localized | null;
  terms: Localized | null;
  eventTypeKeys: string[];
  publicPrice: string;
  publicPriceNote: Localized | null;
  showPublicPrice: boolean;
  published: boolean;
  sortOrder: number;
};

export function PackageEditor({
  id,
  defaults,
  eventTypes,
}: {
  id: string | null;
  defaults: Defaults;
  eventTypes: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(savePackageAction.bind(null, id), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardHeader><CardTitle>Package</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <LocalizedField name="name" label="Name" required defaultValue={defaults.name} errors={e} />
          <TextField name="slug" label="Short address" defaultValue={defaults.slug} placeholder="e.g. royal-wedding" error={e.slug} />
          <LocalizedField name="description" label="Description" multiline rows={3} defaultValue={defaults.description} errors={e} />
          <LocalizedField name="inclusions" label="Included (one per line)" multiline rows={5} defaultValue={defaults.inclusions} errors={e} />
          <LocalizedField name="addOns" label="Optional add-ons (one per line)" multiline rows={3} defaultValue={defaults.addOns} errors={e} />
          <LocalizedField name="terms" label="Terms" multiline rows={3} defaultValue={defaults.terms} errors={e} />
          <fieldset>
            <legend className="text-sm font-medium">For these events</legend>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {eventTypes.map((type) => (
                <label key={type.value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="eventTypeKeys" value={type.value} defaultChecked={defaults.eventTypeKeys.includes(type.value)} className="size-4 accent-primary" />
                  {type.label}
                </label>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Public price</CardTitle>
          <p className="text-sm text-text-muted">Hidden unless ticked below. Booking quotations use their own prices (Phase 3).</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <TextField name="publicPrice" label="Starting price (₹)" inputMode="decimal" defaultValue={defaults.publicPrice} error={e.publicPrice} className="max-w-60" />
          <LocalizedField name="publicPriceNote" label="Price note (e.g. “plus GST, for up to 200 guests”)" defaultValue={defaults.publicPriceNote} errors={e} />
          <CheckboxField name="showPublicPrice" label="Show this price on the website" defaultChecked={defaults.showPublicPrice} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-wrap items-end gap-6 pt-6">
          <CheckboxField name="published" label="Published" defaultChecked={defaults.published} />
          <TextField name="sortOrder" label="Sort order" type="number" min={0} defaultValue={defaults.sortOrder} className="w-32" />
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <SubmitButton>{id ? "Save package" : "Create package"}</SubmitButton>
        {id ? <DeleteButton action={deletePackageAction.bind(null, id)} title="Delete this package?" description="It is removed from the website." /> : null}
      </div>
    </ActionForm>
  );
}
