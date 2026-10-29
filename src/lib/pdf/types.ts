import type { DocumentTypeKey, FieldKey, TemplateKey } from "./fields";

/**
 * Everything a document template may print. The server fills only the parts
 * for ticked fields, so an unticked field is absent from the HTML entirely
 * (not merely hidden). All values are plain, pre-formatted strings.
 */
export type Money = string; // already formatted, e.g. "₹1,25,000.00"

export type DocParty = { label: string; name: string; mobile?: string | null; email?: string | null; altPhone?: string | null };

export type DocFunction = {
  name: string;
  date: string;
  time: string;
  hall: string;
  guests: number | null;
  plates: number | null;
  menuName: string | null;
  menu: { course: string; items: string[] }[];
  dietaryNotes: string | null;
  instructions: string | null;
};

export type DocLine = {
  description: string;
  functionLabel: string | null;
  sac: string;
  quantity: string;
  unit: string;
  rate: Money;
  discount: Money | null;
  taxable: Money;
  taxRate: string;
  cgst: Money;
  sgst: Money;
  igst: Money;
  total: Money;
};

export type DocTotals = {
  subtotal?: Money;
  discount?: Money | null;
  taxable: Money;
  cgst: Money;
  sgst: Money;
  igst: Money;
  tax: Money;
  roundOff: Money | null;
  grandTotal: Money;
  inWords: string;
};

export type DocumentData = {
  type: DocumentTypeKey;
  title: string;
  template: TemplateKey;
  fields: FieldKey[];
  reference: string;
  bookingReference: string;
  generatedAt: string;
  draft: boolean;
  business: {
    displayName: string;
    legalName: string | null;
    gstin: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    tagline: string | null;
    footer: string | null;
  };
  customer?: { name?: string; company?: string | null; mobile?: string; email?: string | null; address?: string | null };
  event?: { name: string; type: string; dates: string; guests: number | null };
  functions?: DocFunction[];
  halls?: { name: string; details: string[] }[];
  parties?: DocParty[];
  quotation?: {
    version: number;
    status: string;
    validUntil: string | null;
    supplyType: "INTRA" | "INTER";
    lines?: DocLine[];
    totals: DocTotals;
    showDiscount: boolean;
    /** Only versions made before GST was removed (26 Oct 2026) carry tax. */
    gst: { pricesIncludeTax: boolean; placeOfSupply: string } | null;
  };
  payments?: {
    received?: { date: string; label: string; method: string; amount: Money; direction: "IN" | "OUT" }[];
    agreed?: Money;
    netReceived?: Money;
    balance?: Money;
    schedule?: { label: string; dueOn: string; amount: Money; paid: Money; status: string }[];
  };
  /** The amount entered when the booking was made, printed when no quotation has been accepted. */
  bookingAmount?: { amount: Money; inWords: string };
  receipt?: { number: string; date: string; amount: Money; method: string; transactionRef: string | null; inWords: string; balanceAfter?: Money };
  invoice?: {
    number: string;
    date: string;
    supplier: { legalName: string; gstin: string | null; address: string; state: string | null; phone: string | null; email: string | null };
    recipient: { name: string; company: string | null; gstin: string | null; address: string | null; state: string | null };
    supplyType: "INTRA" | "INTER";
    /** Only invoices issued before GST was removed (26 Oct 2026) carry tax. */
    gst: { placeOfSupply: string } | null;
    lines: DocLine[];
    totals: DocTotals;
    notes: string | null;
    status: string;
  };
  creditNote?: {
    number: string;
    date: string;
    invoiceNumber: string;
    invoiceDate: string;
    reason: string;
    supplier: NonNullable<DocumentData["invoice"]>["supplier"];
    recipient: NonNullable<DocumentData["invoice"]>["recipient"];
    supplyType: "INTRA" | "INTER";
    gst: boolean;
    lines: DocLine[];
    totals: DocTotals;
  };
  terms?: { payment?: string | null; cancellation?: string | null; conditions?: string | null; bank?: string | null };
  notes?: { special?: string[]; internal?: string | null; custom?: string | null };
};
