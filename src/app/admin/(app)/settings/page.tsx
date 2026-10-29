import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { SETTINGS_LABELS } from "@/lib/settings/schemas";
import { formatIST } from "@/lib/time";
import { requirePermission } from "@/server/auth/session";
import { assignableStaff } from "@/server/services/leads";
import { getAllSettings } from "@/server/services/settings";
import { activeWhatsApp, whatsAppSettingsView } from "@/server/services/whatsapp/config";
import { listTemplates } from "@/server/services/whatsapp/providers";

import { BusinessForm, ContactForm, EnquiryForm } from "./settings-forms";
import { PolicySettings } from "./policy-settings";
import { WhatsAppSettingsForm, WhatsAppStatus, WhatsAppTestAgain, WhatsAppTestMessage } from "./whatsapp-settings";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Settings" };

/** Approved templates for the test-message form; a provider outage must not break Settings. */
async function testTemplates() {
  const active = await activeWhatsApp();
  if (!active) return null;
  try {
    return (await listTemplates(active)).map((t) => ({ key: t.key, label: `${t.name} (${t.language}, ${t.category.toLowerCase()})`, variableCount: t.variableCount, body: t.body, unsupported: t.unsupported }));
  } catch (error) {
    return error instanceof Error ? error.message : "Could not load templates";
  }
}

export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const [settings, staff, policies, whatsapp, templates] = await Promise.all([
    getAllSettings(),
    assignableStaff(),
    db.cancellationPolicy.findMany({ where: { active: true }, select: { id: true, name: true } }),
    whatsAppSettingsView(),
    testTemplates(),
  ]);
  const stamp = (iso: string | null | undefined) => (iso ? formatIST(new Date(iso)) : null);
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
        <Card id="whatsapp">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle>WhatsApp messaging</CardTitle>
              <WhatsAppStatus view={whatsapp} formatted={{ testedAt: stamp(whatsapp.test?.at), webhookAt: stamp(whatsapp.lastWebhookAt) }} />
            </div>
            {whatsapp.provider !== "none" ? <WhatsAppTestAgain /> : null}
          </CardHeader>
          <CardContent className="space-y-8">
            <WhatsAppSettingsForm view={whatsapp} />
            {Array.isArray(templates) ? (
              <section className="space-y-3 border-t border-border pt-6">
                <h3 className="font-medium">Send a test message</h3>
                {templates.length ? (
                  <WhatsAppTestMessage templates={templates} />
                ) : (
                  <p className="text-sm text-text-muted">No approved templates yet. Create one in {whatsapp.provider === "twilio" ? "Twilio Content Template Builder" : "Meta WhatsApp Manager → Message templates"} and wait for approval.</p>
                )}
              </section>
            ) : typeof templates === "string" ? (
              <p className="text-sm text-danger">Could not load templates: {templates}</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
