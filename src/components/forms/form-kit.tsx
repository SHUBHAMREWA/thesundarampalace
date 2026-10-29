"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, use, useEffect, useId, useRef, useTransition, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/server/actions/helpers";

/**
 * Small form kit for CRM/CMS screens: plain <form action> + useActionState,
 * server-side Zod validation, errors shown next to fields.
 */

const PendingContext = createContext<boolean | null>(null);

/** Field errors of the surrounding ActionPanel, so fields rendered by server components show their own errors. */
export const FormErrorsContext = createContext<Record<string, string> | undefined>(undefined);

export function useFieldError(name: string, explicit?: string): string | undefined {
  const errors = use(FormErrorsContext);
  return explicit ?? errors?.[name];
}

/**
 * <form> for useActionState actions that does NOT clear the fields afterwards
 * (React resets uncontrolled forms after every action, which would wipe a
 * user's edits when the server rejects them). Requires JavaScript.
 */
export function ActionForm({
  action,
  children,
  ...props
}: Omit<ComponentProps<"form">, "action" | "onSubmit"> & { action: (data: FormData) => void }) {
  const [pending, startTransition] = useTransition();
  return (
    <PendingContext value={pending}>
      <form
        {...props}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(() => action(data));
        }}
      >
        {children}
      </form>
    </PendingContext>
  );
}

export function SubmitButton({ children, className, ...props }: ComponentProps<typeof Button>) {
  const formStatus = useFormStatus();
  const pending = use(PendingContext) ?? formStatus.pending;
  return (
    <Button type="submit" disabled={pending} className={className} {...props}>
      {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}

/**
 * Toast on success, redirect when asked, alert on failure. Warnings (e.g. a
 * hold on the same slot) stay on screen; `inline` also keeps the success
 * message visible (used by "Check availability").
 */
export function ActionFeedback({
  state,
  resetOn,
  inline = false,
}: {
  state: ActionState;
  resetOn?: React.RefObject<HTMLFormElement | null>;
  inline?: boolean;
}) {
  const body = <ActionToast state={state} resetOn={resetOn} silent={inline} />;
  if (state.ok) {
    if (!inline && !state.warnings?.length) return body;
    return (
      <>
        {body}
        <Alert variant={state.warnings?.length ? "warning" : "success"} role="status">
          <AlertDescription>
            {inline && state.message ? <p className="font-medium">{state.message}</p> : null}
            {state.warnings?.length ? (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {state.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </AlertDescription>
        </Alert>
      </>
    );
  }
  if (!state.message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>
        <p>{state.message}</p>
        {state.warnings?.length ? (
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {state.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function ActionToast({ state, resetOn, silent }: { state: ActionState; resetOn?: React.RefObject<HTMLFormElement | null>; silent: boolean }) {
  const router = useRouter();
  const lastAt = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!state.at || state.at === lastAt.current) return;
    lastAt.current = state.at;
    if (state.ok) {
      if (state.message && !silent) toast.success(state.message);
      if (resetOn?.current) resetOn.current.reset();
      if (state.redirectTo) router.push(state.redirectTo);
    }
  }, [state, router, resetOn, silent]);
  return null;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  name,
  label,
  error,
  hint,
  className,
  ...props
}: ComponentProps<typeof Input> & { name: string; label: string; error?: string; hint?: string }) {
  error = useFieldError(name, error);
  const uid = useId();
  const id = props.id ?? `f${uid}${name.replace(/[^\w-]/g, "-")}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} className={className}>
      <Input
        id={id}
        name={name}
        aria-invalid={!!error}
        aria-describedby={[error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined}
        className="bg-surface"
        {...props}
      />
    </Field>
  );
}

export function TextAreaField({
  name,
  label,
  error,
  hint,
  className,
  ...props
}: ComponentProps<typeof Textarea> & { name: string; label: string; error?: string; hint?: string }) {
  error = useFieldError(name, error);
  const uid = useId();
  const id = props.id ?? `f${uid}${name.replace(/[^\w-]/g, "-")}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} className={className}>
      <Textarea
        id={id}
        name={name}
        aria-invalid={!!error}
        aria-describedby={[error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined}
        className="bg-surface"
        {...props}
      />
    </Field>
  );
}

export const nativeSelectClass =
  "h-9 w-full rounded-md border border-input bg-surface px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function SelectField({
  name,
  label,
  error,
  hint,
  options,
  placeholder,
  className,
  ...props
}: ComponentProps<"select"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  error = useFieldError(name, error);
  const uid = useId();
  const id = props.id ?? `f${uid}${name.replace(/[^\w-]/g, "-")}`;
  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} className={className}>
      <select id={id} name={name} aria-invalid={!!error} className={nativeSelectClass} {...props}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  const uid = useId();
  const id = `f${uid}${name.replace(/[^\w-]/g, "-")}`;
  return (
    <div className="flex items-start gap-3">
      <input id={id} name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-1 size-4 accent-primary" />
      <div>
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

/** English (required or optional) + Hindi (optional) inputs for one CMS field. */
export function LocalizedField({
  name,
  label,
  defaultValue,
  errors,
  multiline = false,
  rows = 4,
  required = false,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: { en?: string; hi?: string } | null;
  errors?: Record<string, string>;
  multiline?: boolean;
  rows?: number;
  required?: boolean;
  hint?: string;
}) {
  const Control = multiline ? TextAreaField : TextField;
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Control
          name={`${name}.en`}
          label={`English${required ? "" : " (optional)"}`}
          defaultValue={defaultValue?.en ?? ""}
          error={errors?.[`${name}.en`] ?? errors?.[name]}
          {...(multiline ? { rows } : {})}
        />
        <Control
          name={`${name}.hi`}
          label="हिन्दी (optional)"
          lang="hi"
          defaultValue={defaultValue?.hi ?? ""}
          error={errors?.[`${name}.hi`]}
          {...(multiline ? { rows } : {})}
        />
      </div>
    </fieldset>
  );
}

export const RICH_TEXT_HINT =
  "Blank line = new paragraph · ## Heading · - list item · **bold** · *italic* · [link text](https://…). HTML is not allowed.";
