import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SETTINGS_LABELS, type SettingsSectionKey } from "@/lib/settings/schemas";
import { requirePermission } from "@/server/auth/session";
import { getAllSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Settings" };

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Read-only in Phase 1. Editing forms arrive with the modules that use each
 * section (business details and enquiries in Phase 2, policies in Phase 3).
 */
export default async function SettingsPage() {
  await requirePermission("settings.manage");
  const settings = await getAllSettings();
  return (
    <>
      <PageHeader
        title="Settings"
        description="Values marked “Not set” must be supplied by the business before launch."
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Settings" }]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(settings) as SettingsSectionKey[]).map((section) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle>{SETTINGS_LABELS[section]}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border text-sm">
                {Object.entries(settings[section]).map(([field, value]) => (
                  <div key={field} className="flex justify-between gap-4 py-2">
                    <dt className="text-text-muted">{humanize(field)}</dt>
                    <dd className="text-right">
                      {value === null ? <Badge variant="warning">Not set</Badge> : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
