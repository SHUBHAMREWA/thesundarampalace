import { redirect } from "next/navigation";

// CRM pages read the session on every request (see src/app/admin/layout.tsx).
export const instant = false;

export default function CmsIndex() {
  redirect("/admin/cms/pages");
}
