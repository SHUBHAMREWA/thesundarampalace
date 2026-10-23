"use client";

import { useActionState, useRef } from "react";

import { ActionForm, ActionFeedback, nativeSelectClass, SelectField, SubmitButton, TextField } from "@/components/forms/form-kit";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { createStaffAction, setStaffActiveAction, setStaffRoleAction } from "@/server/actions/staff";
import { idleState } from "@/server/actions/helpers-shared";

type Option = { value: string; label: string };

export function CreateStaffForm({ roles }: { roles: Option[] }) {
  const [state, action] = useActionState(createStaffAction, idleState);
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm ref={formRef} action={action} className="space-y-4">
      <ActionFeedback state={state} resetOn={formRef} />
      <TextField name="name" label="Full name" autoComplete="off" error={e.name} />
      <TextField name="email" label="Email" type="email" autoComplete="off" error={e.email} />
      <SelectField name="roleKey" label="Role" options={roles} placeholder="Choose a role" error={e.roleKey} />
      <TextField
        name="temporaryPassword"
        label="Temporary password"
        type="text"
        autoComplete="new-password"
        hint="At least 12 characters. Share it privately; roles that need 2FA set it up at first sign-in."
        error={e.temporaryPassword}
      />
      <SubmitButton>Create account</SubmitButton>
    </ActionForm>
  );
}

export function RoleForm({ userId, current, options }: { userId: string; current: string; options: Option[] }) {
  const [state, action] = useActionState(setStaffRoleAction.bind(null, userId), idleState);
  return (
    <ActionForm action={action} className="flex items-center gap-2">
      <label htmlFor={`role-${userId}`} className="sr-only">Role</label>
      <select id={`role-${userId}`} name="roleKey" defaultValue={current} className={`${nativeSelectClass} h-8 w-44`}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <SubmitButton size="sm" variant="outline">Save</SubmitButton>
      {!state.ok && state.message ? <span className="text-xs text-danger">{state.fieldErrors?.roleKey ?? state.message}</span> : null}
      <ActionFeedback state={{ ...state, message: state.ok ? state.message : undefined }} />
    </ActionForm>
  );
}

export function ActiveToggle({ userId, active, name }: { userId: string; active: boolean; name: string }) {
  const [state, action] = useActionState(setStaffActiveAction.bind(null, userId, !active), idleState);
  if (!active) {
    return (
      <ActionForm action={action}>
        <SubmitButton size="sm" variant="ghost">Reactivate</SubmitButton>
      </ActionForm>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-danger">Deactivate</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <ActionForm action={action} className="space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They are signed out immediately and can&apos;t sign in again until reactivated. Their history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ActionFeedback state={state} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <SubmitButton variant="destructive">Deactivate</SubmitButton>
          </AlertDialogFooter>
        </ActionForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
