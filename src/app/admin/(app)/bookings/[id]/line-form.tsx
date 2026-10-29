"use client";

import { useActionState, useState } from "react";

import {
  ActionFeedback,
  ActionForm,
  FormErrorsContext,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/forms/form-kit";
import { idleState } from "@/server/actions/helpers-shared";
import type { ActionState } from "@/server/actions/helpers";

type Option = { value: string; label: string };

export type LineDefaults = {
  kind?: string;
  subEventId?: string;
  description?: string;
  unit?: string;
  quantity?: string;
  unitPrice?: string;
  discount?: string;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/**
 * A quotation line, typed in by hand: what it is, how many, at what rate.
 * Every customer gets their own price, so nothing comes from a catalogue.
 * The total shown here is only a preview; the server computes the real one.
 */
export function LineForm({
  action,
  functions,
  defaults = {},
  submitLabel,
  reset,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  functions: Option[];
  defaults?: LineDefaults;
  submitLabel: string;
  reset?: boolean;
}) {
  const [state, run] = useActionState(action, idleState);
  const blank = {
    quantity: "1",
    unitPrice: "",
    description: "",
    subEventId: "",
  };
  const [values, setValues] = useState({ ...blank, ...defaults });
  // After a successful "add", start the next line from a clean form.
  const [seenAt, setSeenAt] = useState(state.at);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    if (state.ok && reset) setValues({ ...blank });
  }
  const set =
    (key: keyof typeof values) => (e: { target: { value: string } }) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));
  const qty = Number(values.quantity.replace(/,/g, ""));
  const rate = Number(values.unitPrice.replace(/,/g, ""));
  const preview =
    Number.isFinite(qty) && Number.isFinite(rate) && values.unitPrice
      ? qty * rate
      : null;

  return (
    <ActionForm action={run} className="space-y-3" aria-label={submitLabel}>
      <ActionFeedback state={state} />
      {/* Kept as they were on existing lines; new lines are plain custom items. */}
      <input type="hidden" name="kind" value={defaults.kind ?? "CUSTOM"} />
      <input type="hidden" name="unit" value={defaults.unit ?? ""} />
      <input type="hidden" name="discount" value={defaults.discount ?? "0"} />
      <FormErrorsContext value={state.fieldErrors}>
        <div className="grid gap-3 md:grid-cols-6">
          <TextField
            name="description"
            label="Item"
            placeholder="e.g. Hall booking, Décor, Food for 600 guests"
            className="md:col-span-3"
            value={values.description}
            onChange={set("description")}
            required
          />
          <TextField
            name="quantity"
            label="Quantity"
            inputMode="decimal"
            value={values.quantity}
            onChange={set("quantity")}
          />
          <TextField
            name="unitPrice"
            label="Rate (₹)"
            inputMode="decimal"
            placeholder="e.g. 150000"
            className="md:col-span-2"
            value={values.unitPrice}
            onChange={set("unitPrice")}
          />
          {functions.length ? (
            <SelectField
              name="subEventId"
              label="For which function (optional)"
              options={functions}
              placeholder="Whole booking"
              className="md:col-span-3"
              value={values.subEventId}
              onChange={set("subEventId")}
            />
          ) : null}
        </div>
      </FormErrorsContext>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="sm">{submitLabel}</SubmitButton>
        {preview !== null ? (
          <p className="text-sm text-text-muted">
            Line total:{" "}
            <strong className="text-foreground">{inr.format(preview)}</strong>
          </p>
        ) : null}
      </div>
    </ActionForm>
  );
}
