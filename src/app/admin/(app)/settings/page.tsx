import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { SETTINGS_LABELS } from "@/lib/settings/schemas";
import { requirePermission } from "@/server/auth/session";
import { assignableStaff } from "@/server/services/leads";
import { getAllSettings } from "@/server/services/settings";

import { BusinessForm, ContactForm, EnquiryForm } from "./settings-forms";
import { PolicySettings } from "./policy-settings";

export const metadata: Metadata = { title: "Settings" };


export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const [settings, staff, policies] = await Promise.all([getAllSettings(), assignableStaff(), db.cancellationPolicy.findMany({ where: { active: true }, select: { id: true, name: true } })]);
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
        <PolicySettings settings={settings} policies={policies} />
      </div>
    </>
  );
}
