import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/crm/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { lookupOptions } from "@/server/services/lookups";
import { AUDIENCES } from "@/server/services/whatsapp/campaigns";
import { activeWhatsApp } from "@/server/services/whatsapp/config";
import { listTemplates } from "@/server/services/whatsapp/providers";

import { CampaignForm } from "./campaign-form";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "New bulk message" };

export default async function NewCampaignPage() {
  const user = await requirePermission("messages.send");
  const active = await activeWhatsApp();
  const crumbs = [
    { label: "Dashboard", href: "/admin" },
    { label: "WhatsApp", href: "/admin/messages" },
    { label: "New bulk message" },
  ];
  if (!active) {
    return (
      <>
        <PageHeader title="New bulk message" crumbs={crumbs} />
        <Alert variant="warning">
          <AlertDescription>
            WhatsApp is not connected yet. <Link href="/admin/settings#whatsapp" className="underline">Add and test the API keys in Settings</Link> first.
          </AlertDescription>
        </Alert>
      </>
    );
  }
  let templates: Awaited<ReturnType<typeof listTemplates>> = [];
  let loadError: string | null = null;
  try {
    templates = await listTemplates(active);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load templates";
  }
  const [categories, statuses] = await Promise.all([lookupOptions("customer_category"), lookupOptions("lead_status")]);
  const audiences = AUDIENCES.filter((a) => (a.value !== "leads" || can(user, "leads.read_all")) && (a.value !== "customers" || can(user, "customers.read")) && (a.value !== "both" || (can(user, "leads.read_all") && can(user, "customers.read"))));

  return (
    <>
      <PageHeader
        title="New bulk message"
        description="Only templates approved by WhatsApp can be sent. Offers (marketing templates) go only to people who said yes to WhatsApp offers."
        crumbs={crumbs}
      />
      {loadError ? (
        <Alert variant="destructive">
          <AlertDescription>Could not load templates: {loadError}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <CampaignForm
              templates={templates.map((t) => ({ key: t.key, name: t.name, language: t.language, category: t.category, body: t.body, variableCount: t.variableCount, unsupported: t.unsupported }))}
              audiences={audiences.map((a) => ({ value: a.value, label: a.label }))}
              categories={categories.map((c) => ({ value: c.value, label: c.label }))}
              statuses={statuses.map((s) => ({ value: s.value, label: s.label }))}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
}
