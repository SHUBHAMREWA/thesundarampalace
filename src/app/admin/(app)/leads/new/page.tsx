import type { Metadata } from "next";

import { ActionPanel } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/forms/form-kit";
import { Card, CardContent } from "@/components/ui/card";
import { createLeadAction } from "@/server/actions/leads";
import { requirePermission } from "@/server/auth/session";
import { lookupOptions } from "@/server/services/lookups";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "New lead" };

/** Quick lead from a call, walk-in or WhatsApp: name and mobile are enough. */
export default async function NewLeadPage() {
  await requirePermission("leads.edit");
  const [sources, eventTypes] = await Promise.all([
    lookupOptions("lead_source"),
    lookupOptions("event_type"),
  ]);
  return (
    <>
      <PageHeader
        title="New lead"
        description="Only name and mobile are needed. Add the rest later on the lead page."
        crumbs={[
          { label: "Dashboard", href: "/admin" },
          { label: "Leads", href: "/admin/leads" },
          { label: "New" },
        ]}
      />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <ActionPanel action={createLeadAction} submitLabel="Add lead">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                name="fullName"
                label="Name"
                autoComplete="off"
                required
              />
              <TextField
                name="phone"
                label="Mobile number"
                inputMode="tel"
                placeholder="98765 43210"
                required
              />
              <SelectField
                name="sourceKey"
                label="Came from"
                options={sources}
                defaultValue={
                  sources.some((s) => s.value === "phone_call")
                    ? "phone_call"
                    : sources[0]?.value
                }
              />
              <SelectField
                name="eventTypeKey"
                label="Event type (optional)"
                options={eventTypes}
                placeholder="—"
              />
              <TextField
                name="preferredDate"
                label="Event date (optional)"
                type="date"
              />
            </div>
            <TextAreaField
              name="message"
              label="Note (optional)"
              rows={3}
              placeholder="What they asked about"
            />
          </ActionPanel>
        </CardContent>
      </Card>
    </>
  );
}
