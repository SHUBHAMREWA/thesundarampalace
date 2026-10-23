"use client";

import { useActionState, useRef, useState } from "react";

import {
  ActionForm,
  ActionFeedback,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from "@/components/forms/form-kit";
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
import {
  addLeadActivityAction,
  archiveLeadAction,
  assignLeadAction,
  changeLeadStatusAction,
  updateLeadDetailsAction,
} from "@/server/actions/leads";
import { idleState } from "@/server/actions/helpers-shared";

type Option = { value: string; label: string; systemKey?: string | null };

export function StatusForm({
  leadId,
  current,
  currentLostReason,
  statuses,
  lostReasons,
}: {
  leadId: string;
  current: string;
  currentLostReason: string | null;
  statuses: Option[];
  lostReasons: Option[];
}) {
  const [state, action] = useActionState(changeLeadStatusAction.bind(null, leadId), idleState);
  const [selected, setSelected] = useState(current);
  const isLost = statuses.find((s) => s.value === selected)?.systemKey === "LOST";
  return (
    <ActionForm action={action} className="space-y-3">
      <ActionFeedback state={state} />
      <SelectField
        name="statusKey"
        label="Status"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        options={statuses}
        error={state.fieldErrors?.statusKey}
      />
      {isLost ? (
        <SelectField
          name="lostReasonKey"
          label="Reason lost"
          defaultValue={currentLostReason ?? ""}
          placeholder="Choose a reason"
          options={lostReasons}
          error={state.fieldErrors?.lostReasonKey}
        />
      ) : null}
      <TextField name="note" label="Note (optional)" />
      <SubmitButton size="sm">Update status</SubmitButton>
    </ActionForm>
  );
}

export function AssignForm({ leadId, current, staff }: { leadId: string; current: string | null; staff: Option[] }) {
  const [state, action] = useActionState(assignLeadAction.bind(null, leadId), idleState);
  return (
    <ActionForm action={action} className="space-y-3">
      <ActionFeedback state={state} />
      <SelectField
        name="assigneeId"
        label="Assigned to"
        defaultValue={current ?? ""}
        placeholder="Unassigned"
        options={staff}
        error={state.fieldErrors?.assigneeId}
      />
      <SubmitButton size="sm" variant="outline">
        Save assignment
      </SubmitButton>
    </ActionForm>
  );
}

export function ActivityForm({ leadId }: { leadId: string }) {
  const [state, action] = useActionState(addLeadActivityAction.bind(null, leadId), idleState);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <ActionForm ref={formRef} action={action} className="space-y-3">
      <ActionFeedback state={state} resetOn={formRef} />
      <SelectField
        name="kind"
        label="Type"
        defaultValue="CALL"
        options={[
          { value: "CALL", label: "Phone call" },
          { value: "WHATSAPP", label: "WhatsApp" },
          { value: "VISIT", label: "Site visit" },
          { value: "NOTE", label: "Note" },
        ]}
      />
      <TextAreaField name="note" label="What happened?" rows={3} error={state.fieldErrors?.note} />
      <SubmitButton size="sm">Log activity</SubmitButton>
    </ActionForm>
  );
}

export type LeadDetailsDefaults = {
  email: string;
  eventTypeKey: string;
  preferredDate: string;
  guestsApprox: string;
  budgetEstimate: string;
  menuPreference: string;
  preferredHallId: string;
  followUpAt: string;
  siteVisitAt: string;
  siteVisitOutcome: string;
};

export function DetailsForm({
  leadId,
  defaults,
  eventTypes,
  halls,
}: {
  leadId: string;
  defaults: LeadDetailsDefaults;
  eventTypes: Option[];
  halls: Option[];
}) {
  const [state, action] = useActionState(updateLeadDetailsAction.bind(null, leadId), idleState);
  const e = state.fieldErrors ?? {};
  return (
    <ActionForm action={action} className="space-y-4">
      <ActionFeedback state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="followUpAt" label="Next follow-up (IST)" type="datetime-local" defaultValue={defaults.followUpAt} error={e.followUpAt} />
        <SelectField name="eventTypeKey" label="Event type" defaultValue={defaults.eventTypeKey} placeholder="—" options={eventTypes} />
        <TextField name="preferredDate" label="Preferred date" type="date" defaultValue={defaults.preferredDate} />
        <TextField name="guestsApprox" label="Expected guests" type="number" min={1} defaultValue={defaults.guestsApprox} error={e.guestsApprox} />
        <TextField name="budgetEstimate" label="Estimated budget (₹)" inputMode="decimal" defaultValue={defaults.budgetEstimate} error={e.budgetEstimate} />
        <SelectField
          name="menuPreference"
          label="Menu preference"
          defaultValue={defaults.menuPreference}
          placeholder="—"
          options={[
            { value: "veg", label: "Vegetarian" },
            { value: "jain", label: "Jain" },
            { value: "non_veg", label: "Non-vegetarian" },
          ]}
        />
        <SelectField name="preferredHallId" label="Preferred venue" defaultValue={defaults.preferredHallId} placeholder="—" options={halls} />
        <TextField name="email" label="Email" type="email" defaultValue={defaults.email} error={e.email} />
        <TextField name="siteVisitAt" label="Site visit (IST)" type="datetime-local" defaultValue={defaults.siteVisitAt} error={e.siteVisitAt} />
        <TextField name="siteVisitOutcome" label="Site visit outcome" defaultValue={defaults.siteVisitOutcome} />
      </div>
      <SubmitButton size="sm">Save details</SubmitButton>
    </ActionForm>
  );
}

export function ArchiveLeadButton({ leadId }: { leadId: string }) {
  const [state, action] = useActionState(archiveLeadAction.bind(null, leadId), idleState);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-danger">
          Archive lead
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <ActionForm action={action} className="space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              Use this for spam or duplicates. The lead disappears from lists but its history is kept and the action is
              recorded in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ActionFeedback state={state} />
          <TextField name="reason" label="Reason" required error={state.fieldErrors?.reason} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <SubmitButton variant="destructive">Archive</SubmitButton>
          </AlertDialogFooter>
        </ActionForm>
      </AlertDialogContent>
    </AlertDialog>
  );
}
