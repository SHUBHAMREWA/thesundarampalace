import { Inbox } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/crm/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { requirePermission } from "@/server/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requirePermission("dashboard.view");
  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(" ")[0]}`} description="The Sundaram Palace CRM" />
      <EmptyState
        icon={Inbox}
        title="No enquiries yet"
        description="Website enquiries, follow-ups and upcoming events will appear here once the leads module is live."
      />
    </>
  );
}
