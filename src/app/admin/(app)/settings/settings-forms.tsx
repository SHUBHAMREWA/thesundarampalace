"use client";

import { useActionState } from "react";

import {
  ActionForm,
  ActionFeedback,
  LocalizedField,
  RICH_TEXT_HINT,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/forms/form-kit";
import type { SettingsSection } from "@/lib/settings/schemas";
import { idleState } from "@/server/actions/helpers-shared";
import { saveSettingsAction } from "@/server/actions/settings";

export function BusinessForm({ defaults }: { defaults: SettingsSection<"business"> }) {
  const [state, action] = useActionState(saveSettingsAction.bind(null, "business"), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-4">
      <ActionFeedback state={state} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField name="displayName" label="Display name" defaultValue={defaults.displayName} error={e.displayName} />
        <TextField name="legalName" label="Legal name (for invoices)" defaultValue={defaults.legalName ?? ""} error={e.legalName} />
        <TextField name="phone" label="Phone (click-to-call)" type="tel" defaultValue={defaults.phone ?? ""} error={e.phone} hint="Shows the Call buttons on the website." />
        <TextField name="whatsapp" label="WhatsApp number" type="tel" defaultValue={defaults.whatsapp ?? ""} error={e.whatsapp} hint="Shows the WhatsApp buttons on the website." />
        <TextField name="email" label="Public email" type="email" defaultValue={defaults.email ?? ""} error={e.email} />
        <TextField name="officeHours" label="Office hours" defaultValue={defaults.officeHours ?? ""} placeholder="e.g. Mon–Sun, 10:00–19:00" />
        <TextField name="city" label="City" defaultValue={defaults.city ?? ""} />
      </div>
      <TextAreaField name="address" label="Full address" rows={2} defaultValue={defaults.address ?? ""} />
      <SubmitButton>Save business details</SubmitButton>
    </ActionForm>
  );
}

export function ContactForm({ defaults }: { defaults: SettingsSection<"contact"> }) {
  const [state, action] = useActionState(saveSettingsAction.bind(null, "contact"), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-4">
      <ActionFeedback state={state} />
      <TextField
        name="mapEmbedUrl"
        label="Google Maps embed link"
        defaultValue={defaults.mapEmbedUrl ?? ""}
        hint="In Google Maps: Share → Embed a map → copy only the src link (starts with https://www.google.com/maps/embed?)."
        error={e.mapEmbedUrl}
      />
      <TextField name="mapLink" label="Google Maps link (for “Get directions”)" defaultValue={defaults.mapLink ?? ""} error={e.mapLink} />
      <LocalizedField name="directions" label="How to reach us" multiline rows={4} defaultValue={defaults.directions} errors={e} hint={RICH_TEXT_HINT} />
      <LocalizedField name="whatsappMessage" label="Pre-filled WhatsApp message" defaultValue={defaults.whatsappMessage} errors={e} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField name="googleReviewsUrl" label="Google reviews link" defaultValue={defaults.googleReviewsUrl ?? ""} error={e.googleReviewsUrl} />
        <TextField name="instagramUrl" label="Instagram" defaultValue={defaults.instagramUrl ?? ""} error={e.instagramUrl} />
        <TextField name="facebookUrl" label="Facebook" defaultValue={defaults.facebookUrl ?? ""} error={e.facebookUrl} />
        <TextField name="youtubeUrl" label="YouTube" defaultValue={defaults.youtubeUrl ?? ""} error={e.youtubeUrl} />
      </div>
      <TextField
        name="googleSiteVerification"
        label="Google Search Console verification"
        defaultValue={defaults.googleSiteVerification ?? ""}
        hint="In Search Console choose “HTML tag” and paste the tag or just its content value."
        error={e.googleSiteVerification}
      />
      <SubmitButton>Save contact page</SubmitButton>
    </ActionForm>
  );
}

export function EnquiryForm({
  defaults,
  staff,
}: {
  defaults: SettingsSection<"enquiry">;
  staff: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(saveSettingsAction.bind(null, "enquiry"), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-4">
      <ActionFeedback state={state} />
      <div className="grid gap-4 md:grid-cols-3">
        <SelectField
          name="defaultAssigneeId"
          label="Assign new enquiries to"
          defaultValue={defaults.defaultAssigneeId ?? ""}
          placeholder="Nobody (unassigned)"
          options={staff}
        />
        <TextField
          name="duplicateWindowDays"
          label="Merge repeat enquiries within (days)"
          type="number"
          min={0}
          max={365}
          defaultValue={defaults.duplicateWindowDays}
          error={e.duplicateWindowDays}
          hint="Same phone number within this window updates the open lead. 0 turns merging off."
        />
        <TextField
          name="consentNoticeVersion"
          label="Consent notice version"
          defaultValue={defaults.consentNoticeVersion}
          error={e.consentNoticeVersion}
          hint="Change this whenever the consent or privacy wording changes."
        />
      </div>
      <LocalizedField
        name="responseTimePromise"
        label="Response-time promise (shown after an enquiry)"
        defaultValue={defaults.responseTimePromise}
        errors={e}
        hint="e.g. “We'll reply within 2 working hours.” Leave empty for a neutral message."
      />
      <SubmitButton>Save enquiry settings</SubmitButton>
    </ActionForm>
  );
}
