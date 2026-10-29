import type { ReactNode } from "react";

import { CmsTabs } from "@/components/cms/cms-tabs";
import { requirePermission } from "@/server/auth/session";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export default async function CmsLayout({ children }: { children: ReactNode }) {
  await requirePermission("cms.edit");
  return (
    <div>
      <CmsTabs />
      {children}
    </div>
  );
}
