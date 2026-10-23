"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { ActionFeedback, ActionForm, CheckboxField, FormErrorsContext, SelectField, SubmitButton, TextAreaField, TextField } from "@/components/forms/form-kit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { idleState } from "@/server/actions/helpers-shared";
import type { ActionState } from "@/server/actions/helpers";

type Option = { value: string; label: string };

export type CustomerDefaults = Partial<Record<
  | "fullName" | "mobile" | "whatsapp" | "email" | "gstin" | "companyName" | "categoryKey" | "professionKey" | "professionOther"
  | "stateCode" | "city" | "locality" | "address" | "notes" | "maritalStatus" | "dateOfBirth" | "anniversary" | "spouseName",
  string
>>;

/**
 * Create / edit a customer. Personal fields (DOB, marital details, address)
 * are rendered only for staff allowed to see them; the server ignores them
 * from anyone else.
 */
export function CustomerForm({
  action,
  defaults = {},
  categories,
  professions,
  states,
  maritalStatuses,
  showPersonal,
  submitLabel,
  hidden = {},
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  defaults?: CustomerDefaults;
  categories: Option[];
  professions: Option[];
  states: Option[];
  maritalStatuses: Option[];
  showPersonal: boolean;
  submitLabel: string;
  hidden?: Record<string, string>;
}) {
  const [state, run] = useActionState(action, idleState);
  const [marital, setMarital] = useState(defaults.maritalStatus ?? "");
  const [profession, setProfession] = useState(defaults.professionKey ?? "");
  const existingId = state.data?.existingId as string | undefined;
  return (
    <ActionForm action={run} className="space-y-6">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ActionFeedback state={state} />
      {existingId ? (
        <Alert variant="warning">
          <AlertDescription>
            <p>
              <Link href={`/admin/customers/${existingId}`} className="font-medium underline">
                Open {String(state.data?.existingName)} ({String(state.data?.existingReference)})
              </Link>{" "}
              — most likely the same person.
            </p>
            <div className="mt-2">
              <CheckboxField name="allowDuplicate" label="It's a different person — create a new customer anyway" hint="A manager will review the two records." />
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      <FormErrorsContext value={state.fieldErrors}>
        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Contact</legend>
          <TextField name="fullName" label="Full name" required defaultValue={defaults.fullName} autoComplete="off" />
          <TextField name="mobile" label="Mobile number" type="tel" required defaultValue={defaults.mobile} autoComplete="off" />
          <TextField name="whatsapp" label="WhatsApp number (if different)" type="tel" defaultValue={defaults.whatsapp} />
          <TextField name="email" label="Email" type="email" defaultValue={defaults.email} />
          <TextField name="companyName" label="Company (business customers)" defaultValue={defaults.companyName} />
          <TextField name="gstin" label="GSTIN (business customers)" defaultValue={defaults.gstin} />
          <SelectField name="stateCode" label="State (place of supply)" defaultValue={defaults.stateCode ?? ""} placeholder="—" options={states} />
          <TextField name="city" label="City" defaultValue={defaults.city} />
          <SelectField name="categoryKey" label="Customer category" defaultValue={defaults.categoryKey ?? ""} placeholder="—" options={categories} hint="A business decision by authorised staff." />
          <SelectField name="professionKey" label="Profession" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="—" options={professions} />
          {profession === "other" ? <TextField name="professionOther" label="Profession (other)" defaultValue={defaults.professionOther} /> : null}
        </fieldset>
        {showPersonal ? (
          <fieldset className="grid gap-4 md:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Personal details (optional)</legend>
            <SelectField name="maritalStatus" label="Marital status" value={marital} onChange={(e) => setMarital(e.target.value)} placeholder="—" options={maritalStatuses} />
            <TextField name="dateOfBirth" label="Date of birth (only if greetings are used)" type="date" defaultValue={defaults.dateOfBirth} />
            {marital === "married" ? (
              <>
                <TextField name="spouseName" label="Spouse name" defaultValue={defaults.spouseName} />
                <TextField name="anniversary" label="Marriage anniversary" type="date" defaultValue={defaults.anniversary} />
              </>
            ) : null}
            <TextField name="locality" label="Locality" defaultValue={defaults.locality} />
            <TextAreaField name="address" label="Full address" rows={2} defaultValue={defaults.address} className="md:col-span-2" />
          </fieldset>
        ) : null}
        <TextAreaField name="notes" label="Internal notes" rows={3} defaultValue={defaults.notes} />
      </FormErrorsContext>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
