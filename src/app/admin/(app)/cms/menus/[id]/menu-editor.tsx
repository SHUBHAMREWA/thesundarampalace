"use client";

import { useActionState } from "react";

import { DeleteButton } from "@/components/cms/delete-button";
import { ActionForm, ActionFeedback, CheckboxField, LocalizedField, SelectField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MENU_CATEGORIES, MENU_COURSES } from "@/lib/content/catalog";
import type { Localized } from "@/lib/i18n/localized";
import { deleteMenuAction, saveMenuAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";
import en from "@messages/en.json";

type Defaults = {
  name: Localized | null;
  category: string;
  description: Localized | null;
  publicVisible: boolean;
  sortOrder: number;
  courses: Record<string, { en: string; hi: string }>;
};

export function MenuEditor({ id, defaults }: { id: string | null; defaults: Defaults }) {
  const [state, action] = useActionState(saveMenuAction.bind(null, id), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-6">
      <ActionFeedback state={state} />
      <Card>
        <CardHeader><CardTitle>Menu</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <LocalizedField name="name" label="Menu name" required defaultValue={defaults.name} errors={e} />
          <SelectField
            name="category"
            label="Category"
            defaultValue={defaults.category}
            options={MENU_CATEGORIES.map((c) => ({ value: c, label: en.catalog.menuCategory[c] }))}
            hint="Only list Non-vegetarian if the business offers it."
          />
          <LocalizedField name="description" label="Description" multiline rows={2} defaultValue={defaults.description} errors={e} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Dishes by course</CardTitle>
          <p className="text-sm text-text-muted">
            One dish per line. Add a description after a dash: “Paneer tikka — smoky, from the tandoor”. Hindi lines match the
            English lines by position.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {MENU_COURSES.map((course) => (
            <LocalizedField
              key={course}
              name={`course.${course}`}
              label={en.catalog.course[course]}
              multiline
              rows={4}
              defaultValue={defaults.courses[course]}
              errors={e}
            />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="flex flex-wrap items-end gap-6 pt-6">
          <CheckboxField name="publicVisible" label="Show on the Catering page" defaultChecked={defaults.publicVisible} />
          <TextField name="sortOrder" label="Sort order" type="number" min={0} defaultValue={defaults.sortOrder} className="w-32" />
        </CardContent>
      </Card>
      <div className="flex items-center justify-between">
        <SubmitButton>{id ? "Save menu" : "Create menu"}</SubmitButton>
        {id ? <DeleteButton action={deleteMenuAction.bind(null, id)} title="Delete this menu?" description="It is removed from the website." /> : null}
      </div>
    </ActionForm>
  );
}
