import type { PermissionKey } from "@/lib/permissions/registry";

/**
 * PDF field picker registry (pdf-documents skill). Staff tick exactly which
 * fields a document shows. Sensitive fields start unticked and need a
 * permission; fields an invoice always needs can't be unticked.
 */

export const FIELD_KEYS = [
  "customer.name",
  "customer.mobile",
  "customer.email",
  "customer.address",
  "event.main",
  "event.functions",
  "event.halls",
  "event.guests",
  "party.bride",
  "party.groom",
  "menu.items",
  "pricing.lines",
  "pricing.discount",
  "pricing.total",
  "payments.received",
  "payments.balance",
  "payments.schedule",
  "terms.payment",
  "terms.cancellation",
  "terms.conditions",
  "bank.details",
  "notes.special",
  "notes.internal",
  "notes.custom",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export type FieldDef = {
  key: FieldKey;
  label: string;
  group: "Customer" | "Event" | "Bride and groom" | "Menu" | "Pricing" | "Payments" | "Terms" | "Notes";
  sensitive?: boolean;
  permission?: PermissionKey;
};

export const FIELDS: Record<FieldKey, FieldDef> = {
  "customer.name": { key: "customer.name", label: "Customer name", group: "Customer" },
  "customer.mobile": { key: "customer.mobile", label: "Mobile number", group: "Customer" },
  "customer.email": { key: "customer.email", label: "Email", group: "Customer" },
  "customer.address": { key: "customer.address", label: "Address", group: "Customer", sensitive: true, permission: "customers.personal.read" },
  "event.main": { key: "event.main", label: "Main event and dates", group: "Event" },
  "event.functions": { key: "event.functions", label: "Functions with dates, halls and slots", group: "Event" },
  "event.halls": { key: "event.halls", label: "Hall information", group: "Event" },
  "event.guests": { key: "event.guests", label: "Guest count", group: "Event" },
  "party.bride": { key: "party.bride", label: "Bride details", group: "Bride and groom", sensitive: true, permission: "customers.read" },
  "party.groom": { key: "party.groom", label: "Groom details", group: "Bride and groom", sensitive: true, permission: "customers.read" },
  "menu.items": { key: "menu.items", label: "Menus", group: "Menu" },
  "pricing.lines": { key: "pricing.lines", label: "Itemised pricing", group: "Pricing" },
  "pricing.discount": { key: "pricing.discount", label: "Discount", group: "Pricing" },
  "pricing.total": { key: "pricing.total", label: "Total / booking amount", group: "Pricing" },
  "payments.received": { key: "payments.received", label: "Payments received", group: "Payments", permission: "payments.read" },
  "payments.balance": { key: "payments.balance", label: "Pending balance", group: "Payments", permission: "payments.read" },
  "payments.schedule": { key: "payments.schedule", label: "Payment schedule", group: "Payments", permission: "payments.read" },
  "terms.payment": { key: "terms.payment", label: "Payment terms", group: "Terms" },
  "terms.cancellation": { key: "terms.cancellation", label: "Cancellation policy", group: "Terms" },
  "terms.conditions": { key: "terms.conditions", label: "Booking conditions", group: "Terms" },
  "bank.details": { key: "bank.details", label: "Bank details", group: "Terms" },
  "notes.special": { key: "notes.special", label: "Special instructions", group: "Notes" },
  "notes.internal": { key: "notes.internal", label: "Internal notes (staff only)", group: "Notes", sensitive: true, permission: "bookings.edit" },
  "notes.custom": { key: "notes.custom", label: "Custom note (typed below)", group: "Notes" },
};

export const TEMPLATES = [
  { key: "elegant", label: "Elegant Royal" },
  { key: "minimal", label: "Minimal Professional" },
  { key: "detailed", label: "Detailed Quotation" },
  { key: "compact", label: "Compact Booking Summary" },
  { key: "plain", label: "Plain (for the caterer)" },
] as const;
export type TemplateKey = (typeof TEMPLATES)[number]["key"];

export const DOCUMENT_TYPE_KEYS = [
  "quotation",
  "booking_confirmation",
  "payment_receipt",
  "payment_statement",
  "tax_invoice",
  "credit_note",
  "function_sheet",
  "menu",
  "booking_summary",
] as const;
export type DocumentTypeKey = (typeof DOCUMENT_TYPE_KEYS)[number];

export type DocumentTypeDef = {
  key: DocumentTypeKey;
  title: string;
  permission: PermissionKey;
  /** The record the document is about, if any. */
  source: "quotation" | "receipt" | "invoice" | "credit_note" | null;
  fields: FieldKey[];
  defaults: FieldKey[];
  mandatory: FieldKey[];
  templates: TemplateKey[];
  defaultTemplate: TemplateKey;
  /** Financial documents keep a stored copy of every PDF generated. */
  storePdf: boolean;
};

const CUSTOMER: FieldKey[] = ["customer.name", "customer.mobile", "customer.email", "customer.address"];
const EVENT: FieldKey[] = ["event.main", "event.functions", "event.halls", "event.guests"];
const PARTIES: FieldKey[] = ["party.bride", "party.groom"];
const PAYMENTS: FieldKey[] = ["payments.received", "payments.balance"];
/**
 * What the four documents in use offer (owner, 29 Oct 2026). Left out: hall
 * information (the functions already name the hall), menus (the menu is a
 * PDF now), the discount switch (a discount prints whenever there is one),
 * payment terms and cancellation policy (both features were removed) and
 * staff-only notes. Booking conditions and bank details stay, unticked.
 */
const SIMPLE_EVENT: FieldKey[] = ["event.main", "event.functions", "event.guests"];
const SIMPLE_EXTRAS: FieldKey[] = ["terms.conditions", "bank.details", "notes.custom"];
const PAGE_TEMPLATES: TemplateKey[] = ["elegant", "minimal", "compact"];

export const DOCUMENT_TYPES: Record<DocumentTypeKey, DocumentTypeDef> = {
  quotation: {
    key: "quotation",
    title: "Quotation",
    permission: "pdf.quotation",
    source: "quotation",
    fields: [...CUSTOMER, ...SIMPLE_EVENT, ...PARTIES, "pricing.lines", "pricing.total", ...SIMPLE_EXTRAS],
    defaults: ["customer.name", "customer.mobile", "event.main", "event.functions", "event.guests", "pricing.lines", "pricing.total"],
    mandatory: ["pricing.total"],
    templates: ["elegant", "minimal", "detailed"],
    defaultTemplate: "elegant",
    storePdf: false,
  },
  booking_confirmation: {
    key: "booking_confirmation",
    title: "Booking Confirmation",
    permission: "pdf.quotation",
    source: null,
    fields: [...CUSTOMER, ...SIMPLE_EVENT, ...PARTIES, "pricing.total", ...PAYMENTS, ...SIMPLE_EXTRAS],
    defaults: ["customer.name", "customer.mobile", "event.main", "event.functions", "event.guests", "pricing.total", "payments.received", "payments.balance"],
    mandatory: ["event.main"],
    templates: PAGE_TEMPLATES,
    defaultTemplate: "elegant",
    storePdf: false,
  },
  payment_receipt: {
    key: "payment_receipt",
    title: "Payment Receipt",
    permission: "pdf.financial",
    source: "receipt",
    fields: ["customer.name", "customer.mobile", "customer.address", "event.main", "payments.balance", "notes.custom"],
    defaults: ["customer.name", "customer.mobile", "event.main", "payments.balance"],
    mandatory: ["customer.name"],
    templates: ["elegant", "minimal"],
    defaultTemplate: "minimal",
    storePdf: true,
  },
  payment_statement: {
    key: "payment_statement",
    title: "Payment Statement",
    permission: "pdf.financial",
    source: null,
    fields: [...CUSTOMER, "event.main", "pricing.total", ...PAYMENTS, "bank.details", "notes.custom"],
    defaults: ["customer.name", "customer.mobile", "event.main", "pricing.total", "payments.received", "payments.balance"],
    mandatory: ["payments.received", "payments.balance"],
    templates: ["elegant", "minimal"],
    defaultTemplate: "minimal",
    storePdf: true,
  },
  tax_invoice: {
    key: "tax_invoice",
    title: "Invoice",
    permission: "pdf.financial",
    source: "invoice",
    // Number, date, seller and buyer, lines, total and amount in words are always printed.
    fields: ["customer.mobile", "event.main", "bank.details", "notes.custom"],
    defaults: ["event.main"],
    mandatory: [],
    templates: ["minimal", "elegant"],
    defaultTemplate: "minimal",
    storePdf: true,
  },
  credit_note: {
    key: "credit_note",
    title: "Credit Note",
    permission: "pdf.financial",
    source: "credit_note",
    fields: ["customer.mobile", "event.main", "notes.custom"],
    defaults: ["event.main"],
    mandatory: [],
    templates: ["minimal", "elegant"],
    defaultTemplate: "minimal",
    storePdf: true,
  },
  function_sheet: {
    key: "function_sheet",
    title: "Event Function Sheet",
    permission: "pdf.function_sheet",
    source: null,
    fields: ["customer.name", "customer.mobile", ...EVENT, ...PARTIES, "menu.items", "notes.special", "notes.internal", "notes.custom"],
    defaults: ["customer.name", "customer.mobile", "event.main", "event.functions", "event.halls", "event.guests", "menu.items", "notes.special"],
    mandatory: ["event.functions"],
    templates: ["compact", "minimal"],
    defaultTemplate: "compact",
    storePdf: false,
  },
  menu: {
    key: "menu",
    title: "Food Menu",
    permission: "pdf.menu",
    source: null,
    // For the customer and the partner caterer: no prices, ever.
    fields: ["customer.name", "event.main", "event.functions", "event.halls", "event.guests", ...PARTIES, "menu.items", "notes.special", "notes.custom"],
    defaults: ["customer.name", "event.main", "event.functions", "event.guests", "menu.items", "notes.special"],
    mandatory: ["menu.items"],
    templates: ["elegant", "plain"],
    defaultTemplate: "elegant",
    storePdf: false,
  },
  booking_summary: {
    key: "booking_summary",
    title: "Booking Summary",
    permission: "pdf.quotation",
    source: null,
    fields: [...CUSTOMER, ...SIMPLE_EVENT, ...PARTIES, "pricing.total", ...PAYMENTS, ...SIMPLE_EXTRAS],
    defaults: ["customer.name", "customer.mobile", "event.main", "event.functions", "event.guests", "pricing.total", "payments.balance"],
    mandatory: ["event.main"],
    templates: ["compact", "elegant", "minimal"],
    defaultTemplate: "compact",
    storePdf: false,
  },
};

export function isDocumentType(value: string): value is DocumentTypeKey {
  return (DOCUMENT_TYPE_KEYS as readonly string[]).includes(value);
}

export function isFieldKey(value: string): value is FieldKey {
  return (FIELD_KEYS as readonly string[]).includes(value);
}

/**
 * The fields a document will really contain: only those the type allows,
 * the mandatory ones always, and nothing the user lacks permission for.
 */
export function resolveFields(type: DocumentTypeKey, requested: string[], hasPermission: (p: PermissionKey) => boolean): FieldKey[] {
  const def = DOCUMENT_TYPES[type];
  const wanted = new Set<FieldKey>([...requested.filter(isFieldKey), ...def.mandatory]);
  return def.fields.filter((key) => wanted.has(key) && (!FIELDS[key].permission || hasPermission(FIELDS[key].permission!)));
}
