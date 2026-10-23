import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SETTINGS_LABELS } from "@/lib/settings/schemas";
import { requirePermission } from "@/server/auth/session";
import { assignableStaff } from "@/server/services/leads";
import { getAllSettings } from "@/server/services/settings";

import { BusinessForm, ContactForm, EnquiryForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const [settings, staff] = await Promise.all([getAllSettings(), assignableStaff()]);
  return (
    <>
      <PageHeader
        title="Settings"
        description="Only enter details the business has confirmed. Empty values show placeholders on the website."
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Settings" }]}
      />
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>{SETTINGS_LABELS.business}</CardTitle></CardHeader>
          <CardContent><BusinessForm defaults={settings.business} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{SETTINGS_LABELS.contact}</CardTitle></CardHeader>
          <CardContent><ContactForm defaults={settings.contact} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{SETTINGS_LABELS.enquiry}</CardTitle></CardHeader>
          <CardContent>
            <EnquiryForm defaults={settings.enquiry} staff={staff.map((s) => ({ value: s.id, label: s.name }))} />
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          {(["numbering", "bookingPolicy"] as const).map((section) => (
            <Card key={section}>
              <CardHeader>
                <CardTitle>{SETTINGS_LABELS[section]}</CardTitle>
                <p className="text-sm text-text-muted">Editable when bookings arrive in Phase 3.</p>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-border text-sm">
                  {Object.entries(settings[section]).map(([field, value]) => (
                    <div key={field} className="flex justify-between gap-4 py-2">
                      <dt className="text-text-muted">{humanize(field)}</dt>
                      <dd className="text-right">{value === null ? <Badge variant="warning">Not set</Badge> : String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
