"use client";

import { useActionState, useRef, useState, useTransition } from "react";

import { ActionFeedback, ActionForm, FormErrorsContext, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/form-kit";
import { Button } from "@/components/ui/button";
import { idleState } from "@/server/actions/helpers-shared";
import type { ActionState } from "@/server/actions/helpers";

type Option = { value: string; label: string };
type Slot = { id: string; hallId: string | null; label: string };

export type SubEventDefaults = {
  name?: string;
  eventTypeKey?: string;
  date?: string;
  hallId?: string;
  slotDefinitionId?: string;
  customStart?: string;
  customEnd?: string;
  expectedGuests?: string;
  assignedToId?: string;
  specialInstructions?: string;
  internalNotes?: string;
  dietaryNotes?: string;
};

/**
 * Add / edit a function: date, hall and slot (or custom times). "Check
 * availability" previews conflicts without saving. If saving hits a confirmed
 * booking, users allowed to override see a reason box.
 */
export function SubEventForm({
  save,
  check,
  defaults = {},
  types,
  halls,
  slots,
  staff,
  canOverride,
  submitLabel,
}: {
  save: (prev: ActionState, form: FormData) => Promise<ActionState>;
  check: (prev: ActionState, form: FormData) => Promise<ActionState>;
  defaults?: SubEventDefaults;
  types: Option[];
  halls: Option[];
  slots: Slot[];
  staff: Option[];
  canOverride: boolean;
  submitLabel: string;
}) {
  const [state, run] = useActionState(save, idleState);
  const [checkState, runCheck] = useActionState(check, idleState);
  const [checking, startCheck] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [hallId, setHallId] = useState(defaults.hallId ?? "");
  const [custom, setCustom] = useState(!defaults.slotDefinitionId && !!defaults.customStart);
  const hallSlots = slots.filter((s) => !s.hallId || s.hallId === hallId);
  const showOverride = canOverride && state.data?.conflict === true;

  return (
    <ActionForm ref={formRef} action={run} className="space-y-4" aria-label={submitLabel}>
      <ActionFeedback state={state} />
      {checkState.at ? <ActionFeedback state={checkState} inline /> : null}
      <FormErrorsContext value={state.fieldErrors ?? checkState.fieldErrors}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField name="name" label="Function name" defaultValue={defaults.name} placeholder="e.g. Sangeet" required />
          <SelectField name="eventTypeKey" label="Function type" options={types} defaultValue={defaults.eventTypeKey ?? ""} placeholder="Choose…" />
          <TextField name="date" label="Date" type="date" defaultValue={defaults.date} required />
          <SelectField name="hallId" label="Hall" options={halls} value={hallId} onChange={(e) => setHallId(e.target.value)} placeholder="Choose…" />
          <fieldset className="space-y-2 md:col-span-2">
            <legend className="text-sm font-medium">Time</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={!custom} onChange={() => setCustom(false)} className="accent-primary" /> Use a slot
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={custom} onChange={() => setCustom(true)} className="accent-primary" /> Custom times
              </label>
            </div>
            {custom ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="slotDefinitionId" value="" />
                <TextField name="customStart" label="Starts (24h, IST)" type="time" defaultValue={defaults.customStart} />
                <TextField name="customEnd" label="Ends (earlier time = next day)" type="time" defaultValue={defaults.customEnd} />
              </div>
            ) : (
              <SelectField
                name="slotDefinitionId"
                label="Slot"
                options={hallSlots.map((s) => ({ value: s.id, label: s.label }))}
                defaultValue={defaults.slotDefinitionId ?? ""}
                placeholder={hallId ? (hallSlots.length ? "Choose…" : "No slots set up — use custom times") : "Choose a hall first"}
              />
            )}
          </fieldset>
          <TextField name="expectedGuests" label="Expected guests" type="number" min={1} defaultValue={defaults.expectedGuests} />
          <SelectField name="assignedToId" label="Assigned staff" options={staff} defaultValue={defaults.assignedToId ?? ""} placeholder="—" />
        </div>
        <TextAreaField name="specialInstructions" label="Special instructions (function sheet)" rows={2} defaultValue={defaults.specialInstructions} />
        <TextAreaField name="dietaryNotes" label="Dietary notes (kitchen sheet)" rows={2} defaultValue={defaults.dietaryNotes} />
        <TextAreaField name="internalNotes" label="Internal notes" rows={2} defaultValue={defaults.internalNotes} />
        {showOverride ? (
          <TextAreaField
            name="overrideReason"
            label="Override the clash — reason (recorded in the audit log)"
            rows={2}
            hint="Only if the business has agreed to both bookings using this hall at this time."
          />
        ) : null}
      </FormErrorsContext>
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm">{submitLabel}</SubmitButton>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={checking}
          onClick={() => {
            if (!formRef.current) return;
            const data = new FormData(formRef.current);
            startCheck(() => runCheck(data));
          }}
        >
          {checking ? "Checking…" : "Check availability"}
        </Button>
      </div>
    </ActionForm>
  );
}
