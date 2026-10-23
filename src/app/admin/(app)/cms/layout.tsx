import type { ReactNode } from "react";

import { CmsTabs } from "@/components/cms/cms-tabs";
import { requirePermission } from "@/server/auth/session";

export default async function CmsLayout({ children }: { children: ReactNode }) {
  await requirePermission("cms.edit");
  return (
    <div>
      <CmsTabs />
      {children}
    </div>
  );
}
