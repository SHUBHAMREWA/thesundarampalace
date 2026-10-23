"use client";

import { useActionState, useRef, useState } from "react";

import { ActionFeedback, ActionForm, FormErrorsContext, SelectField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { idleState } from "@/server/actions/helpers-shared";
import type { ActionState } from "@/server/actions/helpers";

type Option = { value: string; label: string };
export type ServiceOption = { id: string; label: string; name: string; unit: string; defaultPrice: string | null; taxCategoryId: string };

const KINDS: Option[] = [
  { value: "SERVICE", label: "Service" },
  { value: "PLATES", label: "Plates (per-plate rate)" },
  { value: "PACKAGE", label: "Package" },
  { value: "CUSTOM", label: "Custom item" },
  { value: "EXTRA_PLATES", label: "Extra plates" },
];

export type LineDefaults = {
  kind?: string;
  subEventId?: string;
  description?: string;
  unit?: string;
  quantity?: string;
  unitPrice?: string;
  discount?: string;
  taxCategoryId?: string;
};

/**
 * A quotation line. Picking a catalogue service fills in its name, unit,
 * default price and tax category (all still editable). The server computes
 * every amount; nothing typed here is trusted as a total.
 */
export function LineForm({
  action,
  services,
  taxCategories,
  functions,
  defaults = {},
  submitLabel,
  reset,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  services: ServiceOption[];
  taxCategories: Option[];
  functions: Option[];
  defaults?: LineDefaults;
  submitLabel: string;
  reset?: boolean;
}) {
  const [state, run] = useActionState(action, idleState);
  const ref = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<LineDefaults & { serviceItemId?: string }>({ kind: "SERVICE", discount: "0", quantity: "1", ...defaults });
  // After a successful "add", start the next line from a clean form.
  const [seenAt, setSeenAt] = useState(state.at);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    if (state.ok && reset) setValues({ kind: "SERVICE", discount: "0", quantity: "1" });
  }
  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));
  return (
    <ActionForm ref={ref} action={run} className="space-y-3" aria-label={submitLabel}>
      <ActionFeedback state={state} />
      <FormErrorsContext value={state.fieldErrors}>
        <div className="grid gap-3 md:grid-cols-4">
          {services.length ? (
            <SelectField
              name="serviceItemId"
              label="From catalogue"
              className="md:col-span-2"
              options={services.map((s) => ({ value: s.id, label: s.label }))}
              placeholder="— type it in instead —"
              value={values.serviceItemId ?? ""}
              onChange={(e) => {
                const s = services.find((x) => x.id === e.target.value);
                setValues((v) => ({
                  ...v,
                  serviceItemId: e.target.value,
                  ...(s ? { kind: "SERVICE", description: s.name, unit: s.unit, unitPrice: s.defaultPrice ?? v.unitPrice, taxCategoryId: s.taxCategoryId } : {}),
                }));
              }}
            />
          ) : null}
          <SelectField name="kind" label="Type" options={KINDS} value={values.kind} onChange={set("kind")} />
          <SelectField name="subEventId" label="Function (optional)" options={functions} value={values.subEventId ?? ""} onChange={set("subEventId")} placeholder="Whole booking" />
          <TextField name="description" label="Description" className="md:col-span-2" value={values.description ?? ""} onChange={set("description")} />
          <TextField name="unit" label="Unit" value={values.unit ?? ""} onChange={set("unit")} placeholder="event, plate, hour…" />
          <SelectField name="taxCategoryId" label="Tax category" options={taxCategories} value={values.taxCategoryId ?? ""} onChange={set("taxCategoryId")} placeholder="Choose…" />
          <TextField name="quantity" label="Quantity" inputMode="decimal" value={values.quantity ?? ""} onChange={set("quantity")} />
          <TextField name="unitPrice" label="Unit price (₹)" inputMode="decimal" value={values.unitPrice ?? ""} onChange={set("unitPrice")} />
          <TextField name="discount" label="Line discount (₹)" inputMode="decimal" value={values.discount ?? ""} onChange={set("discount")} />
        </div>
      </FormErrorsContext>
      <SubmitButton size="sm">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
