import { LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

import type { PermissionKey } from "@/lib/permissions/registry";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionKey;
};

/**
 * CRM navigation. Modules are added here as each phase ships them, so the
 * sidebar never shows links to pages that don't exist yet.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.manage" },
];

export function visibleNav(permissions: ReadonlySet<PermissionKey>): NavItem[] {
  return NAV_ITEMS.filter((item) => permissions.has(item.permission));
}
