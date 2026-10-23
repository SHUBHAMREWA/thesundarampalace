"use client";

import { useActionState } from "react";

import { ActionForm, ActionFeedback, SubmitButton, TextField } from "@/components/forms/form-kit";
import { createServicePageAction } from "@/server/actions/cms";
import { idleState } from "@/server/actions/helpers-shared";

export function NewServicePageForm() {
  const [state, action] = useActionState(createServicePageAction, idleState);
  return (
    <ActionForm action={action} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
      <div className="sm:col-span-3">
        <ActionFeedback state={state} />
      </div>
      <TextField name="title" label="New service page title" error={state.fieldErrors?.en ?? state.fieldErrors?.title} />
      <TextField name="slug" label="Address (optional)" placeholder="e.g. birthdays" error={state.fieldErrors?.slug ?? state.fieldErrors?.form} />
      <SubmitButton variant="outline">Add page</SubmitButton>
    </ActionForm>
  );
}
