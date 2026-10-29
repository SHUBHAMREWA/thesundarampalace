"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { WhatsAppIcon } from "@/components/shared/whatsapp-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import {
  enquiryFromForm,
  enquiryStep1Schema,
  enquiryStep2Schema,
  enquiryStep3Schema,
  fieldErrorsOf,
  todayIST,
} from "@/lib/validation/enquiry";
import { submitEnquiry, type EnquiryState } from "@/server/actions/enquiry";

import { trackConversion } from "./tracked-link";
import { readAttribution } from "./utm-capture";

type Option = { value: string; label: string };

/** One-page enquiry form (website "Plan your event", Contact and the homepage). */
export type EnquiryFormProps = {
  eventTypes: Option[];
  halls: Option[];
  defaultHall?: string;
  whatsappHref?: string | null;
  responsePromise?: string | null;
  contactLine?: ReactNode;
};

const noopSubscribe = () => () => {};
/** The form is checked in the browser in three parts (event, vision, contact) before sending. */
const PART_SCHEMAS = [
  enquiryStep1Schema,
  enquiryStep2Schema,
  enquiryStep3Schema,
] as const;

const selectClass =
  "h-11 w-full rounded-md border border-input bg-surface px-3 text-base shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none aria-invalid:border-destructive";

/** Wrapper so "Send another enquiry" can start a fresh form. */
export function EnquiryForm(props: EnquiryFormProps) {
  const [round, setRound] = useState(0);
  return (
    <EnquiryFormInner
      key={round}
      {...props}
      onReset={() => setRound((r) => r + 1)}
    />
  );
}

function Field({
  id,
  label,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {optional ? (
          <span className="font-normal text-text-muted"> ({optional})</span>
        ) : null}
      </Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EnquiryFormInner({
  eventTypes,
  halls,
  defaultHall,
  whatsappHref,
  responsePromise,
  contactLine,
  onReset,
}: EnquiryFormProps & { onReset: () => void }) {
  const tr = useTranslations("enquiry");
  const cta = useTranslations("cta");
  const locale = useLocale();
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<EnquiryState, FormData>(
    submitEnquiry,
    { status: "idle" },
  );
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const startedAt = useRef(0);
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const minDate = useSyncExternalStore(
    noopSubscribe,
    todayIST,
    () => undefined,
  );

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const serverErrors =
    state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const errors = { ...serverErrors, ...clientErrors };
  const errorFor = (name: string) =>
    errors[name] ? tr(errors[name] as "required") : undefined;

  useEffect(() => {
    if (state.status === "success")
      formRef.current
        ?.closest("section")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [state.status]);

  if (state.status === "success") {
    return (
      <div
        className="flex flex-col items-center rounded-lg bg-surface p-8 text-center shadow-card"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
        <h2 className="text-display-3 mt-4">{tr("successTitle")}</h2>
        <p className="mt-3 text-lg font-medium">
          {tr("successReference", { reference: state.reference })}
        </p>
        <p className="mt-2 text-text-muted">
          {responsePromise || tr("successResponse")}
        </p>
        {whatsappHref ? (
          <Button asChild variant="outline" className="mt-6">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackConversion("whatsapp_click")}
            >
              <WhatsAppIcon className="text-whatsapp" />
              {cta("whatsapp")}
            </a>
          </Button>
        ) : null}
        <Button type="button" variant="link" className="mt-2" onClick={onReset}>
          {tr("successAgain")}
        </Button>
      </div>
    );
  }

  const id = (name: string) => `${uid}-${name}`;
  const describedBy = (name: string, hint = false) =>
    [
      errors[name] ? `${id(name)}-error` : null,
      hint ? `${id(name)}-hint` : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        const form = event.currentTarget;
        const setHidden = (name: string, value: string) => {
          const input = form.elements.namedItem(name);
          if (input instanceof HTMLInputElement) input.value = value;
        };
        setHidden("startedAt", String(startedAt.current));
        setHidden("attribution", JSON.stringify(readAttribution() ?? {}));
        setHidden("pagePath", window.location.pathname);
        // Check every field, then send. Dispatching manually (instead of
        // <form action>) stops React clearing the fields if the server rejects them.
        event.preventDefault();
        const data = new FormData(form);
        const all = enquiryFromForm(data);
        const problems = PART_SCHEMAS.flatMap((schema) => {
          const result = schema.safeParse(all);
          return result.success
            ? []
            : Object.entries(fieldErrorsOf(result.error));
        });
        if (problems.length) {
          setClientErrors(Object.fromEntries(problems));
          return;
        }
        setClientErrors({});
        startTransition(() => formAction(data));
      }}
      className="rounded-lg bg-surface p-6 shadow-card md:p-8"
    >
      {/* Spam protection: humans never see or fill this field. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor={id("website")}>Website</label>
        <input
          id={id("website")}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </div>
      <input type="hidden" name="startedAt" defaultValue="" />
      <input type="hidden" name="attribution" defaultValue="{}" />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="pagePath" defaultValue="" />

      {state.status === "error" ? (
        <Alert variant="destructive" className="mb-6" role="alert">
          <AlertDescription>
            {state.code === "validation"
              ? tr("errorFix")
              : state.code === "rate_limited"
                ? tr("errorRateLimited")
                : tr("errorGeneric")}
            {state.code !== "validation" && contactLine ? (
              <span className="mt-2 block">{contactLine}</span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-5">
        <fieldset className="space-y-5">
          <Field
            id={id("eventTypeKey")}
            label={tr("eventType")}
            error={errorFor("eventTypeKey")}
          >
            <select
              id={id("eventTypeKey")}
              name="eventTypeKey"
              defaultValue=""
              className={selectClass}
              aria-invalid={!!errors.eventTypeKey}
              aria-describedby={describedBy("eventTypeKey")}
            >
              <option value="" disabled>
                {tr("chooseEventType")}
              </option>
              {eventTypes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id={id("preferredDate")}
              label={tr("preferredDate")}
              optional={tr("optional")}
              error={errorFor("preferredDate")}
            >
              <Input
                id={id("preferredDate")}
                name="preferredDate"
                type="date"
                min={minDate}
                className="h-11 bg-surface"
                aria-invalid={!!errors.preferredDate}
                aria-describedby={describedBy("preferredDate")}
              />
            </Field>
            <Field
              id={id("guestsApprox")}
              label={tr("guests")}
              optional={tr("optional")}
              error={errorFor("guestsApprox")}
            >
              <Input
                id={id("guestsApprox")}
                name="guestsApprox"
                type="number"
                inputMode="numeric"
                min={1}
                className="h-11 bg-surface"
                aria-invalid={!!errors.guestsApprox}
                aria-describedby={describedBy("guestsApprox")}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-5">
          <Field
            id={id("message")}
            label={tr("message")}
            optional={tr("optional")}
            hint={tr("messageHint")}
            error={errorFor("message")}
          >
            <Textarea
              id={id("message")}
              name="message"
              rows={3}
              maxLength={2000}
              className="bg-surface"
              aria-describedby={describedBy("message", true)}
            />
          </Field>
          {halls.length ? (
            <Field
              id={id("preferredHallSlug")}
              label={tr("preferredHall")}
              optional={tr("optional")}
            >
              <select
                id={id("preferredHallSlug")}
                name="preferredHallSlug"
                defaultValue={defaultHall ?? ""}
                className={selectClass}
              >
                <option value="">{tr("noPreference")}</option>
                {halls.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </fieldset>

        <fieldset className="space-y-5">
          <Field
            id={id("fullName")}
            label={tr("fullName")}
            error={errorFor("fullName")}
          >
            <Input
              id={id("fullName")}
              name="fullName"
              autoComplete="name"
              maxLength={120}
              className="h-11 bg-surface"
              aria-invalid={!!errors.fullName}
              aria-describedby={describedBy("fullName")}
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id={id("phone")}
              label={tr("phone")}
              hint={tr("phoneHint")}
              error={errorFor("phone")}
            >
              <Input
                id={id("phone")}
                name="phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                className="h-11 bg-surface"
                aria-invalid={!!errors.phone}
                aria-describedby={describedBy("phone", true)}
              />
            </Field>
            <Field
              id={id("email")}
              label={tr("email")}
              optional={tr("optional")}
              error={errorFor("email")}
            >
              <Input
                id={id("email")}
                name="email"
                type="email"
                autoComplete="email"
                className="h-11 bg-surface"
                aria-invalid={!!errors.email}
                aria-describedby={describedBy("email")}
              />
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {tr("contactPreference")}
            </legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(["whatsapp", "call", "email"] as const).map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="contactPreference"
                    value={value}
                    defaultChecked={value === "whatsapp"}
                    className="size-4 accent-primary"
                  />
                  {tr(
                    value === "whatsapp"
                      ? "viaWhatsapp"
                      : value === "call"
                        ? "viaCall"
                        : "viaEmail",
                  )}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id={id("consent")}
                name="consent"
                className="mt-1"
                aria-invalid={!!errors.consent}
                aria-describedby={describedBy("consent")}
              />
              <Label
                htmlFor={id("consent")}
                className="text-sm leading-relaxed font-normal"
              >
                {tr("consent")}{" "}
                <Link
                  href="/legal/privacy-policy"
                  className="text-primary underline underline-offset-4"
                  target="_blank"
                >
                  {tr("privacyLink")}
                </Link>
              </Label>
            </div>
            {errors.consent ? (
              <p id={`${id("consent")}-error`} className="text-sm text-danger">
                {tr(errors.consent as "consentRequired")}
              </p>
            ) : null}
          </div>
        </fieldset>
      </div>

      <div
        className="mt-8 flex items-center justify-between gap-3"
        data-hide-floating
      >
        <span />
        <Button type="submit" size="lg" disabled={pending || !hydrated}>
          {pending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : null}
          {pending ? tr("sending") : tr("submit")}
        </Button>
      </div>
    </form>
  );
}
