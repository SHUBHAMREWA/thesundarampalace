"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  ActionFeedback,
  ActionForm,
  CheckboxField,
  FormErrorsContext,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
  useFieldError,
} from "@/components/forms/form-kit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { idleState } from "@/server/actions/helpers-shared";
import type { ActionState } from "@/server/actions/helpers";

import { PhotoInput } from "./photo-input";

type Option = { value: string; label: string };

export type CustomerDefaults = Partial<
  Record<
    | "fullName"
    | "mobile"
    | "whatsapp"
    | "email"
    | "companyName"
    | "categoryKey"
    | "professionOther"
    | "city"
    | "locality"
    | "address"
    | "mapsUrl"
    | "notes"
    | "maritalStatus"
    | "dateOfBirth"
    | "approxAge"
    | "anniversary"
    | "spouseName",
    string
  >
> & { professionKeys?: string[]; photoUrl?: string | null };

/** Tick every profession that applies (e.g. Farmer and Politician). */
function ProfessionsField({
  options,
  selected,
  onChange,
}: {
  options: Option[];
  selected: string[];
  onChange: (keys: string[]) => void;
}) {
  const error = useFieldError("professionKeys");
  return (
    <fieldset className="space-y-1.5 md:col-span-2">
      <legend className="text-sm font-medium">
        Profession (choose all that apply)
      </legend>
      <div className="flex flex-wrap gap-2 pt-1">
        {options.map((o) => {
          const checked = selected.includes(o.value);
          return (
            <label
              key={o.value}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50 ${checked ? "border-primary bg-muted text-primary" : "border-border-strong bg-surface"}`}
            >
              <input
                type="checkbox"
                name="professionKeys"
                value={o.value}
                checked={checked}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, o.value]
                      : selected.filter((k) => k !== o.value),
                  )
                }
                className="size-4 accent-primary"
              />
              {o.label}
            </label>
          );
        })}
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </fieldset>
  );
}

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
  maritalStatuses,
  showPersonal,
  submitLabel,
  hidden = {},
  askWhatsappConsent = false,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  defaults?: CustomerDefaults;
  categories: Option[];
  professions: Option[];
  maritalStatuses: Option[];
  showPersonal: boolean;
  submitLabel: string;
  hidden?: Record<string, string>;
  /** New customers: WhatsApp offers start ticked (owner request); untick if the customer said no. */
  askWhatsappConsent?: boolean;
}) {
  const [state, run] = useActionState(action, idleState);
  const [marital, setMarital] = useState(defaults.maritalStatus ?? "");
  const [professionKeys, setProfessionKeys] = useState(
    defaults.professionKeys ?? [],
  );
  const [dateOfBirth, setDateOfBirth] = useState(defaults.dateOfBirth ?? "");
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
              <Link
                href={`/admin/customers/${existingId}`}
                className="font-medium underline"
              >
                Open {String(state.data?.existingName)} (
                {String(state.data?.existingReference)})
              </Link>{" "}
              — most likely the same person.
            </p>
            <div className="mt-2">
              <CheckboxField
                name="allowDuplicate"
                label="It's a different person — create a new customer anyway"
                hint="A manager will review the two records."
              />
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      <FormErrorsContext value={state.fieldErrors}>
        <fieldset className="grid gap-4 md:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Contact</legend>
          <TextField
            name="fullName"
            label="Full name"
            required
            defaultValue={defaults.fullName}
            autoComplete="off"
          />
          <TextField
            name="mobile"
            label="Mobile number"
            type="tel"
            required
            defaultValue={defaults.mobile}
            autoComplete="off"
          />
          <TextField
            name="whatsapp"
            label="WhatsApp number (if different)"
            type="tel"
            defaultValue={defaults.whatsapp}
          />
          <TextField
            name="email"
            label="Email"
            type="email"
            defaultValue={defaults.email}
          />
          <TextField
            name="companyName"
            label="Company (business customers)"
            defaultValue={defaults.companyName}
          />
          <TextField name="city" label="City" defaultValue={defaults.city} />
          <SelectField
            name="categoryKey"
            label="Customer category"
            defaultValue={defaults.categoryKey ?? ""}
            placeholder="—"
            options={categories}
            hint="A business decision by authorised staff."
          />
          <ProfessionsField
            options={professions}
            selected={professionKeys}
            onChange={setProfessionKeys}
          />
          {professionKeys.includes("other") ? (
            <TextField
              name="professionOther"
              label="Profession (other)"
              defaultValue={defaults.professionOther}
            />
          ) : null}
        </fieldset>
        {showPersonal ? (
          <fieldset className="grid gap-4 md:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">
              Personal details (optional)
            </legend>
            <SelectField
              name="maritalStatus"
              label="Marital status"
              value={marital}
              onChange={(e) => setMarital(e.target.value)}
              placeholder="—"
              options={maritalStatuses}
            />
            <PhotoInput currentUrl={defaults.photoUrl} />
            <TextField
              name="dateOfBirth"
              label="Date of birth (only if greetings are used)"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
            {dateOfBirth ? null : (
              <TextField
                name="approxAge"
                label="Approximate age (if date of birth is not known)"
                type="number"
                inputMode="numeric"
                min={1}
                max={110}
                defaultValue={defaults.approxAge}
                hint="Kept as a birth year, so the age stays current."
              />
            )}
            {marital === "married" ? (
              <>
                <TextField
                  name="spouseName"
                  label="Spouse name"
                  defaultValue={defaults.spouseName}
                />
                <TextField
                  name="anniversary"
                  label="Marriage anniversary"
                  type="date"
                  defaultValue={defaults.anniversary}
                />
              </>
            ) : null}
            <TextField
              name="locality"
              label="Locality"
              defaultValue={defaults.locality}
            />
            <TextAreaField
              name="address"
              label="Full address"
              rows={2}
              defaultValue={defaults.address}
              className="md:col-span-2"
            />
            <TextField
              name="mapsUrl"
              label="Google Maps link (optional)"
              type="url"
              inputMode="url"
              placeholder="https://maps.app.goo.gl/…"
              defaultValue={defaults.mapsUrl}
              hint="In Google Maps: Share → Copy link."
              className="md:col-span-2"
            />
          </fieldset>
        ) : null}
        <TextAreaField
          name="notes"
          label="Internal notes"
          rows={3}
          defaultValue={defaults.notes}
        />
        {askWhatsappConsent ? (
          <CheckboxField
            name="whatsappOptIn"
            label="Customer agrees to WhatsApp offers and updates"
            hint="Ticked by default. Untick it if the customer does not want offers on WhatsApp."
            defaultChecked
          />
        ) : null}
      </FormErrorsContext>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
