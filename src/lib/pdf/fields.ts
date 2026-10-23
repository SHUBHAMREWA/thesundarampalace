import type { PermissionKey } from "@/lib/permissions/registry";

/**
 * PDF field picker registry (pdf-documents skill). Staff tick exactly which
 * fields a document shows. Sensitive fields start unticked and need a
 * permission; fields a GST document legally needs can't be unticked.
 */

export const FIELD_KEYS = [
  "customer.name",
  "customer.mobile",
  "customer.email",
  "customer.address",
  "customer.gstin",
  "event.main",
  "event.functions",
  "event.halls",
  "event.guests",
  "party.bride",
  "party.groom",
  "menu.items",
  "package",
  "pricing.lines",
  "pricing.discount",
  "pricing.tax",
  "pricing.total",
  "payments.received",
  "payments.balance",
  "payments.schedule",
  "deposit",
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
  "customer.gstin": { key: "customer.gstin", label: "GSTIN", group: "Customer" },
  "event.main": { key: "event.main", label: "Main event and dates", group: "Event" },
  "event.functions": { key: "event.functions", label: "Functions with dates, halls and slots", group: "Event" },
  "event.halls": { key: "event.halls", label: "Hall information", group: "Event" },
  "event.guests": { key: "event.guests", label: "Guest and plate counts", group: "Event" },
  "party.bride": { key: "party.bride", label: "Bride details", group: "Bride and groom", sensitive: true, permission: "customers.read" },
  "party.groom": { key: "party.groom", label: "Groom details", group: "Bride and groom", sensitive: true, permission: "customers.read" },
  "menu.items": { key: "menu.items", label: "Menus", group: "Menu" },
  package: { key: "package", label: "Package", group: "Menu" },
  "pricing.lines": { key: "pricing.lines", label: "Itemised pricing", group: "Pricing" },
  "pricing.discount": { key: "pricing.discount", label: "Discount", group: "Pricing" },
  "pricing.tax": { key: "pricing.tax", label: "Tax details", group: "Pricing" },
  "pricing.total": { key: "pricing.total", label: "Total", group: "Pricing" },
  "payments.received": { key: "payments.received", label: "Payments received", group: "Payments", permission: "payments.read" },
  "payments.balance": { key: "payments.balance", label: "Pending balance", group: "Payments", permission: "payments.read" },
  "payments.schedule": { key: "payments.schedule", label: "Payment schedule", group: "Payments", permission: "payments.read" },
  deposit: { key: "deposit", label: "Security deposit", group: "Payments", permission: "payments.read" },
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
  { key: "kitchen", label: "Kitchen Sheet" },
] as const;
export type TemplateKey = (typeof TEMPLATES)[number]["key"];

export const DOCUMENT_TYPE_KEYS = [
  "quotation",
  "booking_confirmation",
  "payment_receipt",
  "payment_statement",
  "tax_invoice",
  "credit_note",
  "deposit_settlement",
  "function_sheet",
  "kitchen_sheet",
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

const CUSTOMER: FieldKey[] = ["customer.name", "customer.mobile", "customer.email", "customer.address", "customer.gstin"];
const EVENT: FieldKey[] = ["event.main", "event.functions", "event.halls", "event.guests"];
const PARTIES: FieldKey[] = ["party.bride", "party.groom"];
const PRICING: FieldKey[] = ["pricing.lines", "pricing.discount", "pricing.tax", "pricing.total"];
const PAYMENTS: FieldKey[] = ["payments.received", "payments.balance", "payments.schedule", "deposit"];
const TERMS: FieldKey[] = ["terms.payment", "terms.cancellation", "terms.conditions", "bank.details"];
const NOTES: FieldKey[] = ["notes.special", "notes.internal", "notes.custom"];
const PAGE_TEMPLATES: TemplateKey[] = ["elegant", "minimal", "compact"];

export const DOCUMENT_TYPES: Record<DocumentTypeKey, DocumentTypeDef> = {
  quotation: {
    key: "quotation",
    title: "Quotation",
    permission: "pdf.quotation",
    source: "quotation",
    fields: [...CUSTOMER, ...EVENT, ...PARTIES, "menu.items", "package", ...PRICING, ...TERMS, ...NOTES],
    defaults: ["customer.name", "customer.mobile", "event.main", "event.functions", "event.guests", "menu.items", "package", ...PRICING, "terms.payment", "terms.cancellation", "terms.conditions", "bank.details"],
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
    fields: [...CUSTOMER, ...EVENT, ...PARTIES, "menu.items", "package", ...PRICING, ...PAYMENTS, ...TERMS, ...NOTES],
    defaults: ["customer.name", "customer.mobile", "event.main", "event.functions", "event.halls", "event.guests", "menu.items", "pricing.total", "payments.received", "payments.balance", "payments.schedule", "terms.cancellation", "terms.conditions"],
    mandatory: ["event.main", "event.functions"],
    templates: PAGE_TEMPLATES,
    defaultTemplate: "elegant",
    storePdf: false,
  },
  payment_receipt: {
    key: "payment_receipt",
    title: "Payment Receipt",
    permission: "pdf.financial",
    source: "receipt",
    fields: ["customer.name", "customer.mobile", "customer.address", "customer.gstin", "event.main", "payments.balance", "notes.custom"],
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
    defaults: ["customer.name", "customer.mobile", "event.main", "pricing.total", "payments.received", "payments.balance", "payments.schedule", "deposit"],
    mandatory: ["payments.received", "payments.balance"],
    templates: ["elegant", "minimal"],
    defaultTemplate: "minimal",
    storePdf: true,
  },
  tax_invoice: {
    key: "tax_invoice",
    title: "Tax Invoice",
    permission: "pdf.financial",
    source: "invoice",
    // Legal particulars (numbers, GSTINs, SAC, taxable value, tax split,
    // place of supply, amount in words) are always printed.
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
  deposit_settlement: {
    key: "deposit_settlement",
    title: "Security Deposit Settlement",
    permission: "pdf.financial",
    source: null,
    fields: ["customer.name", "customer.mobile", "event.main", "deposit", "bank.details", "notes.custom"],
    defaults: ["customer.name", "customer.mobile", "event.main", "deposit"],
    mandatory: ["deposit"],
    templates: ["minimal", "elegant"],
    defaultTemplate: "minimal",
    storePdf: true,
  },
  function_sheet: {
    key: "function_sheet",
    title: "Event Function Sheet",
    permission: "pdf.function_sheet",
    source: null,
    fields: ["customer.name", "customer.mobile", ...EVENT, ...PARTIES, "menu.items", "package", "notes.special", "notes.internal", "notes.custom"],
    defaults: ["customer.name", "customer.mobile", "event.main", "event.functions", "event.halls", "event.guests", "menu.items", "notes.special"],
    mandatory: ["event.functions"],
    templates: ["compact", "minimal"],
    defaultTemplate: "compact",
    storePdf: false,
  },
  kitchen_sheet: {
    key: "kitchen_sheet",
    title: "Kitchen / Menu Sheet",
    permission: "pdf.kitchen_sheet",
    source: null,
    // No prices on kitchen sheets, ever.
    fields: ["event.main", "event.functions", "event.guests", "menu.items", "notes.special", "notes.custom"],
    defaults: ["event.main", "event.functions", "event.guests", "menu.items", "notes.special"],
    mandatory: ["menu.items"],
    templates: ["kitchen"],
    defaultTemplate: "kitchen",
    storePdf: false,
  },
  booking_summary: {
    key: "booking_summary",
    title: "Booking Summary",
    permission: "pdf.quotation",
    source: null,
    fields: [...CUSTOMER, ...EVENT, ...PARTIES, "menu.items", "package", ...PRICING, ...PAYMENTS, ...TERMS, ...NOTES],
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
