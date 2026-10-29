"use client";

import { useActionState, useRef, useTransition } from "react";

import {
  ActionFeedback,
  ActionForm,
  FormErrorsContext,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/forms/form-kit";
import { TimeField } from "@/components/forms/time-field";
import { Button } from "@/components/ui/button";
import { idleState } from "@/server/actions/helpers-shared";
import type { ActionState } from "@/server/actions/helpers";

type Option = { value: string; label: string };

export type SubEventDefaults = {
  name?: string;
  eventTypeKey?: string;
  date?: string;
  hallId?: string;
  startTime?: string;
  endTime?: string;
  expectedGuests?: string;
  assignedToId?: string;
  specialInstructions?: string;
  internalNotes?: string;
  dietaryNotes?: string;
};

/**
 * Add / edit a function: date, hall, start and end time. "Check
 * availability" previews conflicts without saving. If saving hits a confirmed
 * booking, users allowed to override see a reason box.
 */
export function SubEventForm({
  save,
  check,
  defaults = {},
  types,
  halls,
  staff,
  canOverride,
  submitLabel,
}: {
  save: (prev: ActionState, form: FormData) => Promise<ActionState>;
  check: (prev: ActionState, form: FormData) => Promise<ActionState>;
  defaults?: SubEventDefaults;
  types: Option[];
  halls: Option[];
  staff: Option[];
  canOverride: boolean;
  submitLabel: string;
}) {
  const [state, run] = useActionState(save, idleState);
  const [checkState, runCheck] = useActionState(check, idleState);
  const [checking, startCheck] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const showOverride = canOverride && state.data?.conflict === true;

  return (
    <ActionForm
      ref={formRef}
      action={run}
      className="space-y-4"
      aria-label={submitLabel}
    >
      <ActionFeedback state={state} />
      {checkState.at ? <ActionFeedback state={checkState} inline /> : null}
      <FormErrorsContext value={state.fieldErrors ?? checkState.fieldErrors}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            name="name"
            label="Function name"
            defaultValue={defaults.name}
            placeholder="e.g. Sangeet"
            required
          />
          <SelectField
            name="eventTypeKey"
            label="Function type"
            options={types}
            defaultValue={defaults.eventTypeKey ?? ""}
            placeholder="Choose…"
          />
          <TextField
            name="date"
            label="Date"
            type="date"
            defaultValue={defaults.date}
            required
          />
          <SelectField
            name="hallId"
            label="Hall"
            options={halls}
            defaultValue={defaults.hallId ?? ""}
            placeholder="Choose…"
          />
          <TimeField
            name="startTime"
            label="Starts"
            defaultValue={defaults.startTime}
          />
          <TimeField
            name="endTime"
            label="Ends"
            hint="An end time earlier than the start means the next day."
            defaultValue={defaults.endTime}
          />
          <TextField
            name="expectedGuests"
            label="Expected guests"
            type="number"
            min={1}
            defaultValue={defaults.expectedGuests}
          />
          <SelectField
            name="assignedToId"
            label="Assigned staff"
            options={staff}
            defaultValue={defaults.assignedToId ?? ""}
            placeholder="—"
          />
        </div>
        <TextAreaField
          name="specialInstructions"
          label="Special instructions (function sheet)"
          rows={2}
          defaultValue={defaults.specialInstructions}
        />
        <TextAreaField
          name="dietaryNotes"
          label="Dietary notes (printed on the menu)"
          rows={2}
          defaultValue={defaults.dietaryNotes}
        />
        <TextAreaField
          name="internalNotes"
          label="Internal notes"
          rows={2}
          defaultValue={defaults.internalNotes}
        />
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
