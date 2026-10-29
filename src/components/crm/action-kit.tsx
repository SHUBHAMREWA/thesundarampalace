"use client";

import { useActionState, useState, type ComponentProps, type ReactNode } from "react";

import { ActionFeedback, ActionForm, FormErrorsContext, SubmitButton, TextAreaField } from "@/components/forms/form-kit";
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
import { idleState } from "@/server/actions/helpers-shared";
import type { ActionState } from "@/server/actions/helpers";

type BoundAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** A fresh idempotency key per successful submit (money forms record once even on double-click). */
export function useIdempotencyKey(state: ActionState): string {
  const [current, setCurrent] = useState(() => ({ key: crypto.randomUUID(), at: state.at }));
  if (state.at !== current.at) {
    const next = { key: state.ok ? crypto.randomUUID() : current.key, at: state.at };
    setCurrent(next);
    return next.key;
  }
  return current.key;
}

/** One-click action (e.g. move up, mark sent) rendered as a tiny form. */
export function InlineAction({
  action,
  children,
  fields,
  ...button
}: { action: BoundAction; children: ReactNode; fields?: Record<string, string> } & Omit<ComponentProps<typeof Button>, "type" | "children">) {
  const [state, run] = useActionState(action, idleState);
  return (
    <ActionForm action={run} className="inline">
      {Object.entries(fields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton {...button}>{children}</SubmitButton>
      {!state.ok && state.message ? <span className="sr-only" role="alert">{state.message}</span> : null}
      <ActionFeedback state={state} />
    </ActionForm>
  );
}

/** Button that opens a confirm dialog; optional reason box and extra fields. */
export function ConfirmAction({
  action,
  label,
  title,
  description,
  confirmLabel,
  reasonName,
  reasonLabel = "Reason",
  reasonRequired = false,
  destructive = false,
  children,
  triggerVariant,
  triggerSize = "sm",
  triggerClassName,
  triggerContent,
  money = false,
}: {
  action: BoundAction;
  label: string;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  reasonName?: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
  destructive?: boolean;
  children?: ReactNode;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
  /** Replaces the trigger look (e.g. an icon-only row button); `label` stays its accessible name. */
  triggerClassName?: string;
  triggerContent?: ReactNode;
  /** Adds an idempotency key (money entries). */
  money?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, run] = useActionState(async (prev: ActionState, form: FormData) => {
    const result = await action(prev, form);
    if (result.ok) setOpen(false);
    return result;
  }, idleState);
  const key = useIdempotencyKey(state);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={triggerVariant ?? (destructive ? "ghost" : "outline")}
          size={triggerSize}
          className={triggerClassName ?? (destructive ? "text-danger" : undefined)}
          aria-label={triggerContent ? label : undefined}
          title={triggerContent ? label : undefined}
        >
          {triggerContent ?? label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <ActionForm action={run} className="space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description ? <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription> : null}
          </AlertDialogHeader>
          {money ? <input type="hidden" name="idempotencyKey" value={key} suppressHydrationWarning /> : null}
          <ActionFeedback state={state} />
          <FormErrorsContext value={state.fieldErrors}>{children}</FormErrorsContext>
          {reasonName ? <TextAreaField name={reasonName} label={reasonLabel} rows={2} required={reasonRequired} error={state.fieldErrors?.[reasonName]} /> : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <SubmitButton variant={destructive ? "destructive" : "default"}>{confirmLabel ?? label}</SubmitButton>
          </AlertDialogFooter>
        </ActionForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Generic form bound to a server action, with feedback. Server components can
 * use it: the fields inside pick up their own errors from FormErrorsContext.
 */
export function ActionPanel({
  action,
  children,
  submitLabel,
  submitVariant,
  className = "space-y-4",
  inline,
  resetAfter,
  money,
  label,
}: {
  action: BoundAction;
  children: ReactNode;
  submitLabel: string;
  /** Accessible name for the form (screen readers, tests). */
  label?: string;
  submitVariant?: ComponentProps<typeof Button>["variant"];
  className?: string;
  inline?: boolean;
  resetAfter?: boolean;
  /** Adds an idempotency key (money entries). */
  money?: boolean;
}) {
  const [state, run] = useActionState(action, idleState);
  const [form, setForm] = useState<HTMLFormElement | null>(null);
  const key = useIdempotencyKey(state);
  return (
    <ActionForm action={run} className={className} ref={setForm} aria-label={label}>
      {/* Server and client each make a random key; either is unique, so the mismatch is harmless. */}
      {money ? <input type="hidden" name="idempotencyKey" value={key} suppressHydrationWarning /> : null}
      <ActionFeedback state={state} inline={inline} resetOn={resetAfter ? { current: form } : undefined} />
      <FormErrorsContext value={state.fieldErrors}>{children}</FormErrorsContext>
      <SubmitButton size="sm" variant={submitVariant}>
        {submitLabel}
      </SubmitButton>
    </ActionForm>
  );
}
