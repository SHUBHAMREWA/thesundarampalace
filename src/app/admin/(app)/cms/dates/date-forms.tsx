"use client";

import { useActionState, useRef } from "react";

import { ActionForm, ActionFeedback, LocalizedField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { addDateAction, deleteDateAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

export function AddDateForm() {
  const [state, action] = useActionState(addDateAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm ref={formRef} action={action} className="space-y-4">
      <ActionFeedback state={state} resetOn={formRef} />
      <TextField name="date" label="Date" type="date" error={e.date} className="max-w-56" />
      <LocalizedField name="label" label="Label (e.g. “Vivah muhurat”)" required errors={e} />
      <LocalizedField name="note" label="Note (optional)" errors={e} />
      <SubmitButton>Add date</SubmitButton>
    </ActionForm>
  );
}

export function DeleteDateButton({ id }: { id: string }) {
  const [, action] = useActionState(deleteDateAction.bind(null, id), idleState);
  return (
    <ActionForm action={action}>
      <SubmitButton size="sm" variant="ghost" className="text-danger">Remove</SubmitButton>
    </ActionForm>
  );
}
