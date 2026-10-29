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
  "customers.delete": "Delete customers (their bookings go too, if none has payments or is confirmed)",

  "catalog.manage": "Edit the food menu",

  "bookings.read": "See bookings (own and assigned events)",
  "bookings.read_all": "See every booking",
  "bookings.edit": "Create and update bookings before confirmation",
  "bookings.confirm": "Confirm and cancel bookings, and change confirmed bookings",
  "bookings.delete": "Delete bookings that have no payments, invoices or deposits",
  "holds.place": "Place tentative date holds",
  "bookings.override_conflict": "Override a slot conflict (with reason)",
  "plates.change_after_lock": "Change guaranteed plates after the guest-count lock date",

  "quotations.create": "Create quotation versions",
  "quotations.accept": "Mark a quotation version as accepted",

  "payments.read": "See payments and balances",
  "payments.create": "Record payments",
  "refunds.create": "Record refunds and adjustments",
  "deposits.manage": "Record security deposits, deductions and refunds",
  "invoices.issue": "Issue invoices",
  "credit_notes.issue": "Issue credit notes",

  "documents.sensitive.read": "View identity documents",
  "documents.sensitive.upload": "Upload identity documents",

  "pdf.quotation": "Generate quotation PDFs",
  "pdf.financial": "Generate receipts, statements, invoices and credit notes",
  "pdf.function_sheet": "Generate event function sheets",
  "pdf.menu": "Print food menus for customers and the caterer (no prices)",
  "documents.templates.manage": "Manage shared print presets and document wording",

  "reports.sales": "See sales reports",
  "reports.financial": "See financial reports and exports",

  "vendors.read": "See vendors and their event assignments",
  "vendors.manage": "Add vendors and assign them to events",
  "expenses.manage": "Record and edit expenses",

  "messages.read": "See WhatsApp message logs and replies",
  "messages.send": "Send bulk WhatsApp messages (approved templates)",

  "tasks.own": "See and update own tasks",
  "tasks.manage": "Create, assign and manage all tasks",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export type RoleKey =
  | "super_admin"
  | "admin"
  | "manager"
  | "sales"
  | "accounts"
  | "operations";

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
    requires2fa: false,
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "admin",
    name: "Admin",
    requires2fa: false,
    permissions: except("settings.manage", "roles.manage"),
  },
  {
    key: "manager",
    name: "Manager",
    requires2fa: false,
    permissions: [
      "dashboard.view",
      "leads.read", "leads.read_all", "leads.edit", "leads.assign",
      "customers.read", "customers.personal.read", "customers.edit", "customers.merge", "customers.delete",
      "bookings.read", "bookings.read_all", "bookings.edit", "bookings.confirm", "bookings.delete", "holds.place",
      "bookings.override_conflict", "plates.change_after_lock",
      "quotations.create", "quotations.accept",
      "payments.read",
      "documents.sensitive.read", "documents.sensitive.upload",
      "pdf.quotation", "pdf.financial", "pdf.function_sheet", "pdf.menu",
      "reports.sales", "reports.financial",
      "messages.read", "messages.send",
      "tasks.own", "tasks.manage",
      "vendors.read", "vendors.manage", "expenses.manage",
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
      "bookings.read", "bookings.read_all", "bookings.edit", "holds.place",
      "quotations.create",
      "pdf.quotation", "pdf.menu",
      "reports.sales",
      "messages.read",
      "tasks.own",
    ],
  },
  {
    key: "accounts",
    name: "Accounts",
    requires2fa: false,
    permissions: [
      "dashboard.view",
      "customers.read",
      "bookings.read", "bookings.read_all",
      "payments.read", "payments.create", "refunds.create", "deposits.manage",
      "invoices.issue", "credit_notes.issue",
      "pdf.financial",
      "reports.financial",
      "tasks.own",
      "vendors.read", "expenses.manage",
    ],
  },
  {
    key: "operations",
    name: "Event Operations",
    requires2fa: false,
    permissions: ["dashboard.view", "bookings.read", "pdf.function_sheet", "pdf.menu", "tasks.own", "vendors.read"],
  },
];

export function isPermissionKey(value: string): value is PermissionKey {
  return Object.hasOwn(PERMISSIONS, value);
}
