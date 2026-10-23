/**
 * Permission registry — the source of truth for permission keys and the
 * default role → permission matrix (docs/security.md §3). Seeded into the
 * database; code always checks permission keys, never role names.
 *
 * Scoping such as "own records only" is applied by policies in
 * src/server/policies when each module is built.
 */

export const PERMISSIONS = {
  "dashboard.view": "See the CRM dashboard",
  "settings.manage": "Change business, tax, numbering and policy settings",
  "users.manage": "Invite, deactivate and assign roles to staff",
  "roles.manage": "Change which permissions each role has",
  "audit.read": "Read the audit log",
  "privacy.requests": "Handle data access, correction and deletion requests",

  "cms.edit": "Edit website content",
  "cms.publish": "Publish website content",

  "leads.read": "See own and unassigned leads",
  "leads.read_all": "See every lead",
  "leads.edit": "Update leads and log activity",
  "leads.assign": "Assign leads to staff",

  "customers.read": "See customer names and contact details",
  "customers.personal.read": "See date of birth, marital status and address",
  "customers.edit": "Create and update customers",
  "customers.merge": "Merge duplicate customers",

  "bookings.read": "See bookings",
  "bookings.edit": "Create and update bookings",
  "bookings.confirm": "Confirm bookings",
  "holds.place": "Place tentative date holds",
  "bookings.override_conflict": "Override a slot conflict (with reason)",

  "quotations.create": "Create quotation versions",
  "quotations.accept": "Mark a quotation version as accepted",

  "payments.read": "See payments and balances",
  "payments.create": "Record payments",
  "refunds.create": "Record refunds and adjustments",
  "deposits.manage": "Record security deposits, deductions and refunds",
  "invoices.issue": "Issue GST tax invoices",
  "credit_notes.issue": "Issue credit notes",

  "documents.sensitive.read": "View identity documents",
  "documents.sensitive.upload": "Upload identity documents",

  "pdf.quotation": "Generate quotation PDFs",
  "pdf.financial": "Generate receipts, statements, invoices and credit notes",
  "pdf.function_sheet": "Generate event function sheets",
  "pdf.kitchen_sheet": "Generate kitchen sheets",

  "reports.sales": "See sales reports",
  "reports.financial": "See financial reports and exports",

  "tasks.own": "See and update own tasks",
  "tasks.manage": "Create, assign and manage all tasks",
  "kitchen.read": "See kitchen sheets for upcoming events",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export type RoleKey =
  | "super_admin"
  | "admin"
  | "manager"
  | "sales"
  | "accounts"
  | "operations"
  | "kitchen";

export type RoleDefinition = {
  key: RoleKey;
  name: string;
  requires2fa: boolean;
  permissions: readonly PermissionKey[];
};

const except = (...excluded: PermissionKey[]) =>
  ALL_PERMISSIONS.filter((p) => !excluded.includes(p));

export const ROLES: readonly RoleDefinition[] = [
  {
    key: "super_admin",
    name: "Super Admin",
    requires2fa: true,
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "admin",
    name: "Admin",
    requires2fa: true,
    permissions: except("settings.manage", "roles.manage"),
  },
  {
    key: "manager",
    name: "Manager",
    requires2fa: false,
    permissions: [
      "dashboard.view",
      "leads.read", "leads.read_all", "leads.edit", "leads.assign",
      "customers.read", "customers.personal.read", "customers.edit", "customers.merge",
      "bookings.read", "bookings.edit", "bookings.confirm", "holds.place",
      "bookings.override_conflict",
      "quotations.create", "quotations.accept",
      "payments.read",
      "documents.sensitive.read", "documents.sensitive.upload",
      "pdf.quotation", "pdf.financial", "pdf.function_sheet", "pdf.kitchen_sheet",
      "reports.sales", "reports.financial",
      "tasks.own", "tasks.manage",
    ],
  },
  {
    key: "sales",
    name: "Sales / Enquiry Team",
    requires2fa: false,
    permissions: [
      "dashboard.view",
      "leads.read", "leads.edit",
      "customers.read", "customers.edit",
      "bookings.read", "bookings.edit", "holds.place",
      "quotations.create",
      "pdf.quotation",
      "reports.sales",
      "tasks.own",
    ],
  },
  {
    key: "accounts",
    name: "Accounts",
    requires2fa: true,
    permissions: [
      "dashboard.view",
      "customers.read",
      "bookings.read",
      "payments.read", "payments.create", "refunds.create", "deposits.manage",
      "invoices.issue", "credit_notes.issue",
      "pdf.financial",
      "reports.financial",
      "tasks.own",
    ],
  },
  {
    key: "operations",
    name: "Event Operations",
    requires2fa: false,
    permissions: ["dashboard.view", "bookings.read", "pdf.function_sheet", "tasks.own"],
  },
  {
    key: "kitchen",
    name: "Kitchen",
    requires2fa: false,
    permissions: ["kitchen.read", "pdf.kitchen_sheet"],
  },
];

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.hasOwn(PERMISSIONS, value);
}
