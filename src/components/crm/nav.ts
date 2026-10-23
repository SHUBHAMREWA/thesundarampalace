import { Bell, Globe, Inbox, LayoutDashboard, Settings, Users, type LucideIcon } from "lucide-react";

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
  { href: "/admin/leads", label: "Leads", icon: Inbox, permission: "leads.read" },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, permission: "dashboard.view" },
  { href: "/admin/cms", label: "Website CMS", icon: Globe, permission: "cms.edit" },
  { href: "/admin/staff", label: "Staff", icon: Users, permission: "users.manage" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.manage" },
];

export function visibleNav(permissions: ReadonlySet<PermissionKey>): NavItem[] {
  return NAV_ITEMS.filter((item) => permissions.has(item.permission));
}
