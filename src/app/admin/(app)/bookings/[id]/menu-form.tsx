"use client";

import { useActionState, useState } from "react";

import { ActionFeedback, ActionForm, FormErrorsContext, SelectField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { idleState } from "@/server/actions/helpers-shared";
import type { ActionState } from "@/server/actions/helpers";

export type MenuPackageOption = {
  id: string;
  label: string;
  minPlates: number | null;
  rules: { course: string; choose: number }[];
  items: { id: string; course: string; name: string }[];
};

/** Choose a menu package, the items for courses with a choice, and guaranteed plates. */
export function MenuForm({
  action,
  packages,
  courseLabels,
  defaults,
  lockNote,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  packages: MenuPackageOption[];
  courseLabels: Record<string, string>;
  defaults: { menuPackageId: string; itemIds: string[]; guaranteedPlates: string };
  lockNote?: string | null;
}) {
  const [state, run] = useActionState(action, idleState);
  const [packageId, setPackageId] = useState(defaults.menuPackageId);
  const pkg = packages.find((p) => p.id === packageId);
  const courses = pkg ? [...new Set(pkg.items.map((i) => i.course))] : [];
  return (
    <ActionForm action={run} className="space-y-4" aria-label="Menu">
      <ActionFeedback state={state} />
      <FormErrorsContext value={state.fieldErrors}>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            name="menuPackageId"
            label="Menu package"
            options={packages.map((p) => ({ value: p.id, label: p.label }))}
            value={packageId}
            onChange={(e) => setPackageId(e.target.value)}
            placeholder="Choose…"
          />
          <TextField
            name="guaranteedPlates"
            label="Guaranteed plates"
            type="number"
            min={pkg?.minPlates ?? 1}
            defaultValue={defaults.guaranteedPlates}
            hint={[pkg?.minPlates ? `Minimum ${pkg.minPlates}.` : null, lockNote].filter(Boolean).join(" ") || undefined}
          />
        </div>
        {pkg ? (
          <div className="space-y-3">
            {courses.map((course) => {
              const rule = pkg.rules.find((r) => r.course === course);
              const items = pkg.items.filter((i) => i.course === course);
              return (
                <fieldset key={course} className="rounded-md border border-border p-3">
                  <legend className="px-1 text-sm font-medium">
                    {courseLabels[course] ?? course} {rule ? <span className="text-text-muted">— choose {rule.choose}</span> : <span className="text-text-muted">— all served</span>}
                  </legend>
                  {rule ? (
                    <div className="grid gap-1 sm:grid-cols-2">
                      {items.map((item) => (
                        <label key={item.id} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="itemIds" value={item.id} defaultChecked={defaults.itemIds.includes(item.id)} className="size-4 accent-primary" />
                          {item.name}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-text-muted">{items.map((i) => i.name).join(", ")}</p>
                  )}
                </fieldset>
              );
            })}
            {state.fieldErrors?.itemIds ? <p className="text-sm text-danger">{state.fieldErrors.itemIds}</p> : null}
          </div>
        ) : null}
      </FormErrorsContext>
      <SubmitButton size="sm">Save menu</SubmitButton>
    </ActionForm>
  );
}
