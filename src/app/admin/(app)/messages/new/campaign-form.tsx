"use client";

import { useActionState, useState } from "react";

import { ActionFeedback, ActionForm, SelectField, SubmitButton, TextField } from "@/components/forms/form-kit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatINR } from "@/lib/money";
import { campaignAction } from "@/server/actions/whatsapp";
import { idleState } from "@/server/actions/helpers-shared";

type Option = { value: string; label: string };
type Template = { key: string; name: string; language: string; category: string; body: string; variableCount: number; unsupported: string | null };

/**
 * Two steps: "Preview" shows how many people get the message and how it reads;
 * any change hides the preview again, so what is sent is what was checked.
 */
export function CampaignForm({ templates, audiences, categories, statuses }: { templates: Template[]; audiences: Option[]; categories: Option[]; statuses: Option[] }) {
  const [state, action] = useActionState(campaignAction, idleState);
  const [templateKey, setTemplateKey] = useState("");
  const [audience, setAudience] = useState(audiences[0]?.value ?? "customers");
  const [seenAt, setSeenAt] = useState(state.at);
  const [showPreview, setShowPreview] = useState(false);
  if (state.at !== seenAt) {
    setSeenAt(state.at);
    setShowPreview(state.ok && state.data?.stage === "preview");
  }
  const template = templates.find((t) => t.key === templateKey);
  const preview = showPreview ? state.data : undefined;
  const allowed = Number(preview?.allowed ?? 0);
  const e = state.fieldErrors ?? {};

  if (!templates.length) {
    return <p className="text-sm text-text-muted">No approved templates yet. Create one in your WhatsApp provider and wait for approval, then come back.</p>;
  }

  return (
    <ActionForm action={action} className="space-y-6" aria-label="New bulk message" onChange={(event) => (event.target as { name?: string }).name !== "confirm" && setShowPreview(false)}>
      <ActionFeedback state={state.data?.stage === "preview" ? { ...state, message: undefined } : state} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField name="name" label="Campaign name (for your records)" placeholder="e.g. Wedding season offer, Nov 2026" error={e.name} />
        <SelectField
          name="template"
          label="Approved template"
          value={templateKey}
          onChange={(event) => setTemplateKey(event.target.value)}
          placeholder="Choose…"
          options={templates.map((t) => ({ value: t.key, label: `${t.name} (${t.language}, ${t.category.toLowerCase()})${t.unsupported ? `: can't send, ${t.unsupported}` : ""}` }))}
          error={e.template}
        />
      </div>
      {template ? (
        <div className="space-y-3">
          <p className="rounded border border-border bg-bg p-3 text-sm whitespace-pre-wrap">{template.body || "(no text)"}</p>
          {template.variableCount > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: template.variableCount }, (_, i) => (
                  <TextField key={`${template.key}-${i}`} name={`variables.${i}`} label={`{{${i + 1}}}`} error={e[`variables.${i}`]} />
                ))}
              </div>
              <p className="text-xs text-text-muted">Type {"{name}"} to use each person&apos;s first name.</p>
            </>
          ) : null}
        </div>
      ) : null}

      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">Who gets it</legend>
        <SelectField name="audience" label="Send to" value={audience} onChange={(event) => setAudience(event.target.value)} options={audiences} error={e.audience} />
        <div className="grid gap-4 md:grid-cols-2">
          {audience !== "leads" ? <SelectField name="customerCategory" label="Customer category" placeholder="All customers" options={categories} defaultValue="" /> : null}
          {audience !== "customers" ? (
            <>
              <SelectField name="leadStatus" label="Lead status" placeholder="All open and closed leads" options={statuses} defaultValue="" />
              <div className="grid grid-cols-2 gap-3">
                <TextField name="leadsFrom" label="Leads from" type="date" />
                <TextField name="leadsTo" label="Leads to" type="date" />
              </div>
            </>
          ) : null}
        </div>
        <p className="text-xs text-text-muted">Each phone number gets one message. Leads already linked to a customer are reached through the customer.</p>
      </fieldset>

      {preview ? (
        <div className="space-y-3 rounded-lg border border-primary bg-blush p-4 text-sm" role="status">
          <p className="text-base font-medium">
            {allowed} {allowed === 1 ? "person" : "people"} will get this message
          </p>
          {Number(preview.skipped) > 0 ? (
            <p className="text-text-muted">
              {String(preview.skipped)} more are skipped: {preview.category === "MARKETING" ? "they haven't said yes to WhatsApp offers" : "they replied STOP or have no contact permission"}. They are listed in the log as skipped.
            </p>
          ) : null}
          {preview.estimatedCost ? <p>Estimated cost: about {formatINR(String(preview.estimatedCost))} (from your per-message rate in Settings).</p> : null}
          <div>
            <p className="mb-1 text-xs text-text-muted">How it reads for the first person:</p>
            <p className="rounded border border-border bg-surface p-3 whitespace-pre-wrap">{String(preview.sample)}</p>
          </div>
          {preview.overLimit ? (
            <Alert variant="destructive">
              <AlertDescription>That is more than the {String(preview.overLimit)} people allowed per campaign. Narrow the audience or raise the limit in Settings.</AlertDescription>
            </Alert>
          ) : allowed > 0 ? (
            <label className="flex items-start gap-2">
              <input type="checkbox" name="confirm" required className="mt-1 size-4 accent-primary" />
              <span>Yes, send this to {allowed} people now.</span>
            </label>
          ) : null}
          <input type="hidden" name="expected" value={allowed} />
        </div>
      ) : null}

      {preview && (allowed === 0 || preview.overLimit) ? (
        <p className="text-sm text-text-muted">Change the template or audience to preview again.</p>
      ) : (
        <SubmitButton>{preview ? `Send to ${allowed} people` : "Preview"}</SubmitButton>
      )}
    </ActionForm>
  );
}
