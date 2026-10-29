"use client";

import { CheckCircle2, CircleAlert, CircleDashed } from "lucide-react";
import { useActionState, useState } from "react";

import { InlineAction } from "@/components/crm/action-kit";
import {
  ActionFeedback,
  ActionForm,
  SelectField,
  SubmitButton,
  TextField,
} from "@/components/forms/form-kit";
import { idleState } from "@/server/actions/helpers-shared";
import {
  saveWhatsAppSettingsAction,
  sendTestMessageAction,
  testWhatsAppAction,
} from "@/server/actions/whatsapp";

type View = {
  provider: "none" | "meta" | "twilio";
  meta: {
    phoneNumberId: string;
    wabaId: string;
    hasAccessToken: boolean;
    hasAppSecret: boolean;
    verifyToken: string;
    webhookUrl: string;
  };
  twilio: {
    accountSid: string;
    from: string;
    hasAuthToken: boolean;
    webhookUrl: string;
  };
  costMarketing: string | null;
  costUtility: string | null;
  maxPerCampaign: number;
  test: { ok: boolean; provider: string; at: string; detail: string } | null;
  lastWebhookAt: string | null;
  ready: boolean;
};

type Template = {
  key: string;
  label: string;
  variableCount: number;
  body: string;
  unsupported: string | null;
};

const PROVIDERS = [
  { value: "none", label: "Off" },
  { value: "meta", label: "Meta WhatsApp Cloud API (direct)" },
  { value: "twilio", label: "Twilio" },
];

const SAVED = "Saved. Leave empty to keep it.";

function Copyable({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded border border-border bg-bg px-2 py-1.5 text-xs">
          {value || "Shown after the first save"}
        </code>
        {value ? (
          <button
            type="button"
            className="rounded border border-border px-2 py-1 text-xs hover:border-primary"
            onClick={() => void navigator.clipboard?.writeText(value)}
          >
            Copy
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function WhatsAppStatus({
  view,
  formatted,
}: {
  view: View;
  formatted: { testedAt: string | null; webhookAt: string | null };
}) {
  if (view.provider === "none") {
    return (
      <p className="flex items-center gap-2 text-sm text-text-muted">
        <CircleDashed className="size-4" aria-hidden="true" /> WhatsApp
        messaging is off. Messages are logged as “not sent”.
      </p>
    );
  }
  const ok = view.ready;
  return (
    <div className="space-y-1 text-sm" role="status">
      <p
        className={`flex items-start gap-2 ${ok ? "text-success" : "text-danger"}`}
      >
        {ok ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        ) : (
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        )}
        <span>
          {ok ? "Connected" : "Not working: sending is paused"}
          {view.test ? ` · tested ${formatted.testedAt}` : ""}
          {view.test?.detail ? `: ${view.test.detail}` : ""}
        </span>
      </p>
      <p className="text-text-muted">
        Delivery updates:{" "}
        {formatted.webhookAt
          ? `last received ${formatted.webhookAt}`
          : "none received yet. Set up the webhook below, then send a test message."}
      </p>
    </div>
  );
}

export function WhatsAppSettingsForm({ view }: { view: View }) {
  const [state, action] = useActionState(saveWhatsAppSettingsAction, idleState);
  const [provider, setProvider] = useState(view.provider);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm
      action={action}
      className="space-y-4"
      aria-label="WhatsApp settings"
    >
      <ActionFeedback state={state} />
      <SelectField
        name="provider"
        label="Send WhatsApp messages with"
        value={provider}
        onChange={(event) =>
          setProvider(event.target.value as View["provider"])
        }
        options={PROVIDERS}
        error={e.provider}
      />
      {/* Hidden sections stay in the form so switching provider keeps the other one's IDs. */}
      <div
        className={
          provider === "meta"
            ? "space-y-4 rounded-lg border border-border p-4"
            : "hidden"
        }
      >
        <p className="text-sm text-text-muted">
          From Meta for Developers → your app → WhatsApp → API Setup. Use a
          permanent System User token, not the 24-hour test token.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            name="metaPhoneNumberId"
            label="Phone number ID"
            inputMode="numeric"
            defaultValue={view.meta.phoneNumberId}
            error={e.metaPhoneNumberId}
          />
          <TextField
            name="metaWabaId"
            label="WhatsApp Business Account ID"
            inputMode="numeric"
            defaultValue={view.meta.wabaId}
            error={e.metaWabaId}
          />
          <TextField
            name="metaAccessToken"
            label="Access token"
            type="password"
            autoComplete="off"
            placeholder={view.meta.hasAccessToken ? SAVED : ""}
            error={e.metaAccessToken}
          />
          <TextField
            name="metaAppSecret"
            label="App secret"
            type="password"
            autoComplete="off"
            placeholder={view.meta.hasAppSecret ? SAVED : ""}
            error={e.metaAppSecret}
            hint="App settings → Basic. Needed to trust delivery updates."
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Copyable label="Webhook callback URL" value={view.meta.webhookUrl} />
          <Copyable
            label="Webhook verify token"
            value={view.meta.verifyToken}
          />
        </div>
        <p className="text-xs text-text-muted">
          In Meta: WhatsApp → Configuration → Webhook → paste both, then
          subscribe to “messages”.
        </p>
      </div>
      <div
        className={
          provider === "twilio"
            ? "space-y-4 rounded-lg border border-border p-4"
            : "hidden"
        }
      >
        <p className="text-sm text-text-muted">
          From the Twilio Console home page (Account Info) and Messaging →
          Senders → WhatsApp senders.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <TextField
            name="twilioAccountSid"
            label="Account SID"
            defaultValue={view.twilio.accountSid}
            placeholder="AC…"
            error={e.twilioAccountSid}
          />
          <TextField
            name="twilioAuthToken"
            label="Auth token"
            type="password"
            autoComplete="off"
            placeholder={view.twilio.hasAuthToken ? SAVED : ""}
            error={e.twilioAuthToken}
          />
          <TextField
            name="twilioFrom"
            label="WhatsApp sender number"
            type="tel"
            defaultValue={view.twilio.from}
            placeholder="+91…"
            error={e.twilioFrom}
          />
        </div>
        <Copyable
          label="Webhook URL (sender → “When a message comes in”)"
          value={view.twilio.webhookUrl}
        />
      </div>
      <div
        className={provider === "none" ? "hidden" : "grid gap-4 md:grid-cols-3"}
      >
        <TextField
          name="costMarketing"
          label="Your cost per marketing message (₹)"
          inputMode="decimal"
          defaultValue={view.costMarketing ?? ""}
          error={e.costMarketing}
          hint="Optional. From your provider's rate card; used only for the cost preview."
        />
        <TextField
          name="costUtility"
          label="Your cost per utility message (₹)"
          inputMode="decimal"
          defaultValue={view.costUtility ?? ""}
          error={e.costUtility}
        />
        <TextField
          name="maxPerCampaign"
          label="Most people per campaign"
          type="number"
          min={1}
          max={100000}
          defaultValue={view.maxPerCampaign}
          error={e.maxPerCampaign}
          hint="A safety limit against sending to the wrong list."
        />
      </div>
      <SubmitButton>
        {provider === "none" ? "Save" : "Save and test connection"}
      </SubmitButton>
      <p className="text-xs text-text-muted">
        Keys are only saved after {provider === "twilio" ? "Twilio" : "Meta"}{" "}
        accepts them. They are stored encrypted and never shown again.
      </p>
    </ActionForm>
  );
}

export function WhatsAppTestAgain() {
  return (
    <InlineAction action={testWhatsAppAction} variant="outline" size="sm">
      Test again
    </InlineAction>
  );
}

export function WhatsAppTestMessage({ templates }: { templates: Template[] }) {
  const [state, action] = useActionState(sendTestMessageAction, idleState);
  const [key, setKey] = useState("");
  const template = templates.find((t) => t.key === key);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm
      action={action}
      className="space-y-4"
      aria-label="Send a test WhatsApp message"
    >
      <ActionFeedback state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          name="phone"
          label="Send to (your own number)"
          type="tel"
          placeholder="+91…"
          error={e.phone}
        />
        <SelectField
          name="template"
          label="Approved template"
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Choose…"
          options={templates.map((t) => ({
            value: t.key,
            label: t.unsupported
              ? `${t.label} (can't send: ${t.unsupported})`
              : t.label,
          }))}
          error={e.template}
        />
      </div>
      {template ? (
        <p className="rounded border border-border bg-bg p-3 text-sm whitespace-pre-wrap">
          {template.body || "(no text)"}
        </p>
      ) : null}
      {template && template.variableCount > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: template.variableCount }, (_, i) => (
            <TextField
              key={i}
              name={`variables.${i}`}
              label={`{{${i + 1}}}`}
              error={e[`variables.${i}`]}
            />
          ))}
        </div>
      ) : null}
      <SubmitButton variant="outline">Send test message</SubmitButton>
    </ActionForm>
  );
}
