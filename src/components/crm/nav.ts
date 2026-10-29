import {
  ClipboardList,
  Globe,
  LayoutDashboard,
  Settings,
  Tags,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { PermissionKey } from "@/lib/permissions/registry";

import type { Tone } from "./icon-chip";

export type NavLink = {
  href: string;
  label: string;
  /** Shown when the user has any of these permissions. */
  permissions: PermissionKey[];
};

export type NavGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Colour of the icon chip in the sidebar. */
  tone: Tone;
  links: NavLink[];
};

/** Website CMS sections (also the tabs at the top of every CMS page). */
export const CMS_SECTIONS = [
  { href: "/admin/cms/pages", label: "Pages" },
  { href: "/admin/cms/home", label: "Homepage" },
  { href: "/admin/cms/about", label: "About" },
  { href: "/admin/cms/halls", label: "Venues" },
  { href: "/admin/cms/menus", label: "Menus" },
  { href: "/admin/cms/decor", label: "Décor" },
  { href: "/admin/cms/gallery", label: "Gallery" },
  { href: "/admin/cms/testimonials", label: "Testimonials" },
  { href: "/admin/cms/blog", label: "Blog" },
  { href: "/admin/cms/media", label: "Media" },
] as const;

/**
 * CRM navigation (owner request, 28 Oct 2026): a short list of main menus,
 * each opening its sub-menu. A group shows only when the user may open at
 * least one of its links, and only those links show.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "home",
    label: "Dashboard",
    icon: LayoutDashboard,
    tone: "rose",
    links: [
      { href: "/admin", label: "Overview", permissions: ["dashboard.view"] },
      { href: "/admin/notifications", label: "Notifications", permissions: ["dashboard.view"] },
    ],
  },
  {
    key: "sales",
    label: "Leads and customers",
    icon: Users,
    tone: "blue",
    links: [
      { href: "/admin/leads", label: "All leads", permissions: ["leads.read"] },
      { href: "/admin/leads/new", label: "Add lead", permissions: ["leads.edit"] },
      { href: "/admin/leads?followUp=overdue&sort=follow_up", label: "Follow-ups due", permissions: ["leads.read"] },
      { href: "/admin/customers", label: "All customers", permissions: ["customers.read"] },
      { href: "/admin/customers/new", label: "Add customer", permissions: ["customers.edit"] },
      { href: "/admin/customers/duplicates", label: "Possible duplicates", permissions: ["customers.merge"] },
    ],
  },
  {
    key: "bookings",
    label: "Bookings",
    icon: ClipboardList,
    tone: "plum",
    links: [
      { href: "/admin/bookings", label: "All bookings", permissions: ["bookings.read"] },
      { href: "/admin/bookings/new", label: "New booking", permissions: ["bookings.edit"] },
      { href: "/admin/calendar", label: "Calendar", permissions: ["bookings.read"] },
    ],
  },
  {
    key: "operations",
    label: "Operations",
    icon: Wrench,
    tone: "amber",
    links: [
      { href: "/admin/tasks", label: "Tasks", permissions: ["tasks.own", "tasks.manage"] },
      { href: "/admin/vendors", label: "Vendors", permissions: ["vendors.read"] },
      { href: "/admin/messages", label: "WhatsApp", permissions: ["messages.read"] },
    ],
  },
  {
    key: "money",
    label: "Money",
    icon: Wallet,
    tone: "green",
    links: [
      { href: "/admin/payments", label: "Payments and reports", permissions: ["reports.sales", "reports.financial", "payments.read"] },
      { href: "/admin/expenses", label: "Expenses", permissions: ["expenses.manage"] },
    ],
  },
  {
    key: "catalog",
    label: "Food menu",
    icon: Tags,
    tone: "gold",
    links: [
      { href: "/admin/catalog", label: "Edit and download", permissions: ["catalog.manage"] },
    ],
  },
  {
    key: "website",
    label: "Website",
    icon: Globe,
    tone: "blue",
    links: CMS_SECTIONS.map((s) => ({ href: s.href, label: s.label, permissions: ["cms.edit"] })),
  },
  {
    key: "admin",
    label: "Admin",
    icon: Settings,
    tone: "red",
    links: [
      { href: "/admin/staff", label: "Staff and roles", permissions: ["users.manage"] },
      { href: "/admin/settings", label: "Settings", permissions: ["settings.manage"] },
      { href: "/admin/audit", label: "Audit log", permissions: ["audit.read"] },
    ],
  },
];

/** The hrefs this user may open (the sidebar shows only these). */
export function visibleNav(permissions: ReadonlySet<PermissionKey>): string[] {
  return NAV_GROUPS.flatMap((g) => g.links.filter((l) => l.permissions.some((p) => permissions.has(p))).map((l) => l.href));
}

/**
 * The link to highlight for a URL: same path (or a sub-page of it) and every
 * query value of the link present in the URL; the most specific one wins.
 */
export function activeHref(hrefs: string[], pathname: string, search: URLSearchParams): string | null {
  let best: { href: string; score: number } | null = null;
  for (const href of hrefs) {
    const [path, query] = href.split("?");
    const pathMatch = path === "/admin" ? pathname === path : pathname === path || pathname.startsWith(`${path}/`);
    if (!pathMatch) continue;
    const wanted = new URLSearchParams(query ?? "");
    if ([...wanted].some(([k, v]) => search.get(k) !== v)) continue;
    const score = path.length * 10 + [...wanted].length;
    if (!best || score > best.score) best = { href, score };
  }
  return best?.href ?? null;
}
