import "server-only";

import en from "@messages/en.json";

import type { InvoiceLine, QuotationLine } from "@/generated/prisma/client";
import { isFirm } from "@/lib/booking/rules";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { allocateToInstalments, amountInWordsINR, bookingBalance, depositTotals, formatINR, money, sumMoney } from "@/lib/money";
import { DOCUMENT_TYPES, resolveFields, type DocumentTypeKey, type FieldKey, type TemplateKey } from "@/lib/pdf/fields";
import type { DocLine, DocumentData, DocTotals } from "@/lib/pdf/types";
import { formatPhoneForDisplay } from "@/lib/contact/links";
import { dateKey, formatDateKey, formatIST, todayIST } from "@/lib/time";
import { gstStateLabel } from "@/lib/validation/gst";
import { assertPermission, can, ForbiddenError, type Actor } from "@/server/policies/authorize";
import { bookingVisibility, type MenuSnapshot } from "@/server/services/bookings";
import { parseSlabs } from "@/server/services/catalog";
import { RuleError } from "@/server/services/errors";
import { NotFoundError } from "@/server/services/leads";
import { labelOf, lookupOptions } from "@/server/services/lookups";
import { PAYMENT_METHODS, type RecipientSnapshot, type SupplierSnapshot } from "@/server/services/money";
import { getSettings } from "@/server/services/settings";

/**
 * Builds the data for one document, containing only the fields the user
 * ticked (plus the mandatory ones) and only what their permissions allow.
 */

export type DocumentRequest = {
  bookingId: string;
  type: DocumentTypeKey;
  template: TemplateKey;
  fields: string[];
  sourceId?: string | null;
  customNote?: string | null;
};

const COURSE_LABELS = en.catalog.course as Record<string, string>;
const methodLabel = (m: string | null) => PAYMENT_METHODS.find((p) => p.value === m)?.label ?? "—";

/**
 * Who may produce a document for a booking: the type's PDF permission plus
 * normal booking visibility. Kitchen staff (no booking access) may produce
 * kitchen sheets for confirmed bookings with a function today or later.
 */
export async function assertDocumentAccess(actor: Actor, bookingId: string, type: DocumentTypeKey) {
  assertPermission(actor, DOCUMENT_TYPES[type].permission);
  if (can(actor, "bookings.read")) {
    const visible = await db.booking.findFirst({ where: { AND: [{ id: bookingId }, bookingVisibility(actor)] }, select: { id: true } });
    if (visible) return;
  }
  if (type === "kitchen_sheet" && can(actor, "kitchen.read")) {
    const upcoming = await db.booking.findFirst({
      where: { id: bookingId, deletedAt: null, status: { in: ["CONFIRMED", "IN_PROGRESS"] }, subEvents: { some: { date: { gte: new Date(`${todayIST()}T00:00:00Z`) } } } },
      select: { id: true },
    });
    if (upcoming) return;
    throw new ForbiddenError("kitchen.read");
  }
  throw new NotFoundError("Booking");
}

function docLine(l: QuotationLine | InvoiceLine, discount: string | null): DocLine {
  const rate = "taxRatePercent" in l ? l.taxRatePercent : l.ratePercent;
  return {
    description: l.description,
    functionLabel: "subEventLabel" in l ? l.subEventLabel : null,
    sac: l.sacCode,
    quantity: money(l.quantity).toDecimalPlaces(3).toString(),
    unit: l.unit,
    rate: formatINR(l.unitPrice),
    discount,
    taxable: formatINR(l.taxableValue),
    taxRate: `${money(rate).toString()}%`,
    cgst: formatINR(l.cgst),
    sgst: formatINR(l.sgst),
    igst: formatINR(l.igst),
    total: formatINR(l.lineTotal),
  };
}

function totals(v: { subtotal?: unknown; discountTotal?: unknown; taxableTotal: unknown; cgstTotal: unknown; sgstTotal: unknown; igstTotal: unknown; taxTotal: unknown; roundOff: unknown; grandTotal: unknown }): DocTotals {
  const s = (x: unknown) => String(x);
  return {
    subtotal: v.subtotal !== undefined ? formatINR(s(v.subtotal)) : undefined,
    discount: v.discountTotal !== undefined && !money(s(v.discountTotal)).isZero() ? formatINR(s(v.discountTotal)) : null,
    taxable: formatINR(s(v.taxableTotal)),
    cgst: formatINR(s(v.cgstTotal)),
    sgst: formatINR(s(v.sgstTotal)),
    igst: formatINR(s(v.igstTotal)),
    tax: formatINR(s(v.taxTotal)),
    roundOff: money(s(v.roundOff)).isZero() ? null : formatINR(s(v.roundOff)),
    grandTotal: formatINR(s(v.grandTotal)),
    inWords: amountInWordsINR(s(v.grandTotal)),
  };
}

/** "Cancelled 90 or more days before the first function: 75% of the amount paid is refunded." */
export function cancellationText(slabs: { daysBeforeEventMin: number; refundPercent: string }[]): string | null {
  if (!slabs.length) return null;
  const sorted = [...slabs].sort((a, b) => b.daysBeforeEventMin - a.daysBeforeEventMin);
  const lines = sorted.map((s, i) => {
    const when =
      s.daysBeforeEventMin > 0
        ? `Cancelled ${s.daysBeforeEventMin} or more days before the first function`
        : `Cancelled less than ${sorted[i - 1]?.daysBeforeEventMin ?? 1} days before the first function`;
    const percent = money(s.refundPercent);
    return `${when}: ${percent.isZero() ? "no refund" : `${percent.toString()}% of the amount paid is refunded`}.`;
  });
  const lowest = sorted[sorted.length - 1];
  if (lowest.daysBeforeEventMin > 0) lines.push(`Cancelled less than ${lowest.daysBeforeEventMin} days before the first function: no refund.`);
  return lines.join("\n");
}

function dateRange(start: Date | null, end: Date | null): string {
  if (!start) return "Dates to be confirmed";
  const a = dateKey(start);
  const b = end ? dateKey(end) : a;
  return a === b ? formatDateKey(a, "EEE d MMM yyyy") : `${formatDateKey(a, "d MMM")} – ${formatDateKey(b, "d MMM yyyy")}`;
}

export async function buildDocumentData(actor: Actor, request: DocumentRequest): Promise<{ data: DocumentData; sourceId: string | null }> {
  const def = DOCUMENT_TYPES[request.type];
  await assertDocumentAccess(actor, request.bookingId, request.type);
  const template = def.templates.includes(request.template) ? request.template : def.defaultTemplate;
  const fields = resolveFields(request.type, request.fields, (p) => can(actor, p));
  const on = (key: FieldKey) => fields.includes(key);

  const booking = await db.booking.findUnique({
    where: { id: request.bookingId },
    include: {
      customer: true,
      package: { select: { name: true } },
      subEvents: {
        orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }],
        include: {
          hall: { select: { id: true, name: true, areaSqFt: true, capacities: true } },
          slotDefinition: { select: { name: true } },
          menuSelection: true,
          reservation: { select: { state: true } },
        },
      },
      parties: true,
    },
  });
  if (!booking) throw new NotFoundError("Booking");
  const [business, docs, eventTypes] = await Promise.all([getSettings("business"), getSettings("documents"), lookupOptions("event_type")]);

  const data: DocumentData = {
    type: request.type,
    title: def.title,
    template,
    fields,
    reference: booking.reference,
    bookingReference: booking.reference,
    generatedAt: formatIST(new Date(), "d MMM yyyy, h:mm a"),
    draft: false,
    business: {
      displayName: business.displayName,
      legalName: business.legalName,
      gstin: business.gstin,
      address: business.address,
      phone: business.phone ? formatPhoneForDisplay(business.phone) : null,
      email: business.email,
      tagline: docs.tagline,
      footer: docs.footerText,
    },
  };

  const customerParts: NonNullable<DocumentData["customer"]> = {};
  if (on("customer.name")) {
    customerParts.name = booking.customer.fullName;
    customerParts.company = booking.customer.companyName;
  }
  if (on("customer.mobile")) customerParts.mobile = formatPhoneForDisplay(booking.customer.mobile);
  if (on("customer.email")) customerParts.email = booking.customer.email;
  if (on("customer.address")) customerParts.address = [booking.customer.address, booking.customer.locality, booking.customer.city].filter(Boolean).join(", ") || null;
  if (on("customer.gstin")) customerParts.gstin = booking.customer.gstin;
  if (Object.keys(customerParts).length) data.customer = customerParts;

  if (on("event.main")) {
    data.event = {
      name: booking.mainEventName,
      type: labelOf(eventTypes, booking.mainEventTypeKey),
      dates: dateRange(booking.startDate, booking.endDate),
      guests: on("event.guests") ? booking.expectedGuests : null,
    };
  }

  const activeFunctions = booking.subEvents.filter((s) => s.reservation?.state !== "CANCELLED");
  if (on("event.functions")) {
    data.functions = activeFunctions.map((s) => {
      const snap = s.menuSelection?.snapshot as unknown as MenuSnapshot | undefined;
      const courses = new Map<string, string[]>();
      for (const item of snap?.items ?? []) courses.set(item.course, [...(courses.get(item.course) ?? []), item.name]);
      return {
        name: s.name,
        date: formatDateKey(dateKey(s.date), "EEE d MMM yyyy"),
        time: `${formatIST(s.startsAt, "h:mm a")} – ${formatIST(s.endsAt, "h:mm a")}`,
        hall: t(s.hall.name, "en"),
        slot: s.slotDefinition?.name ?? null,
        guests: s.expectedGuests,
        plates: s.menuSelection?.guaranteedPlates ?? null,
        menuName: snap ? `${snap.packageName} — ${snap.menuName}` : null,
        menu: [...courses.entries()].map(([course, items]) => ({ course: COURSE_LABELS[course] ?? course, items })),
        dietaryNotes: s.dietaryNotes,
        instructions: s.specialInstructions,
      };
    });
  }
  if (on("event.halls")) {
    const halls = new Map(activeFunctions.map((s) => [s.hall.id, s.hall]));
    data.halls = [...halls.values()].map((h) => ({
      name: t(h.name, "en"),
      details: [
        h.areaSqFt ? `${h.areaSqFt.toLocaleString("en-IN")} sq ft` : null,
        ...h.capacities.filter((c) => c.maxGuests).map((c) => `${c.layout.toLowerCase()} up to ${c.maxGuests}`),
      ].filter((v): v is string => !!v),
    }));
  }
  const parties = [
    on("party.bride") ? booking.parties.find((p) => p.role === "BRIDE") : undefined,
    on("party.groom") ? booking.parties.find((p) => p.role === "GROOM") : undefined,
  ].filter((p): p is NonNullable<typeof p> => !!p);
  if (parties.length) {
    data.parties = parties.map((p) => ({
      label: p.role === "BRIDE" ? "Bride" : "Groom",
      name: p.fullName,
      mobile: p.mobile ? formatPhoneForDisplay(p.mobile) : null,
      email: p.email,
      altPhone: p.altPhone ? formatPhoneForDisplay(p.altPhone) : null,
    }));
  }
  if (on("package")) data.packageName = booking.package ? t(booking.package.name, "en") : null;

  let sourceId: string | null = null;

  // Quotation-style pricing (quotation, confirmation, summary).
  if (fields.some((f) => f.startsWith("pricing."))) {
    const versionId =
      request.type === "quotation"
        ? (request.sourceId ?? booking.acceptedQuotationId ?? (await db.quotationVersion.findFirst({ where: { bookingId: booking.id }, orderBy: { versionNumber: "desc" }, select: { id: true } }))?.id)
        : booking.acceptedQuotationId;
    const version = versionId ? await db.quotationVersion.findFirst({ where: { id: versionId, bookingId: booking.id }, include: { lines: { orderBy: { sortOrder: "asc" } } } }) : null;
    if (request.type === "quotation" && !version) throw new RuleError("Create a quotation version first.");
    if (version) {
      if (request.type === "quotation") {
        sourceId = version.id;
        data.reference = `${booking.reference}/Q${version.versionNumber}`;
        data.draft = version.status === "DRAFT";
      }
      const showDiscount = on("pricing.discount");
      data.quotation = {
        version: version.versionNumber,
        status: version.status,
        validUntil: version.validUntil ? formatDateKey(dateKey(version.validUntil)) : null,
        pricesIncludeTax: version.pricesIncludeTax,
        supplyType: version.supplyType,
        placeOfSupply: gstStateLabel(version.placeOfSupplyStateCode),
        lines: on("pricing.lines")
          ? version.lines.map((l) => {
              const d = money(l.discount).plus(money(l.allocatedDiscount));
              return docLine(l, showDiscount && !d.isZero() ? formatINR(d) : null);
            })
          : undefined,
        totals: totals(showDiscount ? version : { ...version, discountTotal: "0" }),
        showDiscount,
        showTax: on("pricing.tax"),
      };
    }
  }

  // Payments and deposit.
  if (fields.some((f) => f.startsWith("payments.")) || on("deposit") || request.type === "payment_receipt") {
    const [ledger, deposits, instalments, charges, accepted] = await Promise.all([
      db.ledgerEntry.findMany({ where: { bookingId: booking.id }, orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }] }),
      db.depositEntry.findMany({ where: { bookingId: booking.id }, orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }] }),
      db.paymentInstalment.findMany({ where: { bookingId: booking.id }, orderBy: { dueOn: "asc" } }),
      db.postEventCharge.findMany({ where: { bookingId: booking.id }, select: { lineTotal: true } }),
      booking.acceptedQuotationId ? db.quotationVersion.findUnique({ where: { id: booking.acceptedQuotationId }, select: { grandTotal: true } }) : null,
    ]);
    const cancellation = booking.cancellation as { agreedRefund?: string } | null;
    const balance = bookingBalance({
      acceptedTotal: accepted?.grandTotal ?? "0",
      postEventTotal: sumMoney(charges.map((c) => c.lineTotal)),
      ledger,
      deposits,
      cancelled: booking.status === "CANCELLED",
      agreedRefund: cancellation?.agreedRefund ?? null,
    });
    const payments: NonNullable<DocumentData["payments"]> = {};
    if (on("payments.received")) {
      payments.received = ledger.map((e) => ({
        date: formatDateKey(dateKey(e.occurredOn)),
        label: e.type === "PAYMENT" ? `Payment ${e.receiptNumber ?? ""}`.trim() : e.type === "REFUND" ? `Refund — ${e.reason ?? ""}` : `Adjustment — ${e.reason ?? ""}`,
        method: e.method ? methodLabel(e.method) : "—",
        amount: formatINR(e.amount),
        direction: e.direction,
      }));
      payments.agreed = formatINR(balance.billable);
      payments.netReceived = formatINR(balance.netReceived);
    }
    if (on("payments.balance")) payments.balance = formatINR(booking.status === "CANCELLED" ? balance.refundStillDue : balance.outstanding);
    if (on("payments.schedule")) {
      payments.schedule = allocateToInstalments(balance.netReceived, instalments.map((i) => ({ id: i.id, label: i.label, dueOn: dateKey(i.dueOn), amount: i.amount })), todayIST()).map((s) => ({
        label: s.label,
        dueOn: formatDateKey(s.dueOn),
        amount: formatINR(s.amount),
        paid: formatINR(s.paid),
        status: s.status.replace("_", " ").toLowerCase(),
      }));
    }
    if (Object.keys(payments).length) data.payments = payments;
    if (on("deposit")) {
      const d = depositTotals(deposits);
      data.deposit = {
        entries: deposits.map((e) => ({ date: formatDateKey(dateKey(e.occurredOn)), type: { RECEIVED: "Received", DEDUCTION: "Deduction", REFUNDED: "Refunded" }[e.type], amount: formatINR(e.amount), reason: e.reason })),
        received: formatINR(d.received),
        deducted: formatINR(d.deducted),
        refunded: formatINR(d.refunded),
        held: formatINR(d.held),
      };
    }
    if (request.type === "payment_receipt") {
      const entry = request.sourceId ? ledger.find((e) => e.id === request.sourceId && e.type === "PAYMENT") : [...ledger].reverse().find((e) => e.type === "PAYMENT");
      if (!entry || !entry.receiptNumber) throw new RuleError("Choose a recorded payment for the receipt.");
      sourceId = entry.id;
      data.reference = entry.receiptNumber;
      data.receipt = {
        number: entry.receiptNumber,
        date: formatDateKey(dateKey(entry.occurredOn), "d MMM yyyy"),
        amount: formatINR(entry.amount),
        method: methodLabel(entry.method),
        transactionRef: entry.transactionRef,
        inWords: amountInWordsINR(entry.amount),
        balanceAfter: on("payments.balance") ? formatINR(balance.outstanding) : undefined,
      };
    }
  }

  if (request.type === "tax_invoice") {
    const invoice = await db.invoice.findFirst({
      where: { bookingId: booking.id, ...(request.sourceId ? { id: request.sourceId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });
    if (!invoice) throw new RuleError("No tax invoice has been issued for this booking yet.");
    sourceId = invoice.id;
    data.reference = invoice.number;
    const supplier = invoice.supplier as unknown as SupplierSnapshot;
    const recipient = invoice.recipient as unknown as RecipientSnapshot;
    data.business = { ...data.business, gstin: null, address: null };
    data.invoice = {
      number: invoice.number,
      date: formatDateKey(dateKey(invoice.issuedOn), "d MMM yyyy"),
      supplier: { legalName: supplier.legalName, gstin: supplier.gstin, address: supplier.address, state: gstStateLabel(supplier.stateCode), phone: supplier.phone ? formatPhoneForDisplay(supplier.phone) : null, email: supplier.email },
      recipient: { name: recipient.name, company: recipient.companyName, gstin: recipient.gstin, address: recipient.address, state: gstStateLabel(recipient.stateCode) },
      placeOfSupply: gstStateLabel(invoice.placeOfSupplyStateCode),
      supplyType: invoice.supplyType,
      pricesIncludeTax: invoice.pricesIncludeTax,
      lines: invoice.lines.map((l) => docLine(l, money(l.discount).isZero() ? null : formatINR(l.discount))),
      totals: totals({ ...invoice, subtotal: undefined, discountTotal: undefined }),
      notes: invoice.notes,
      status: invoice.status,
    };
    if (on("customer.mobile")) data.customer = { mobile: formatPhoneForDisplay(booking.customer.mobile) };
  }

  if (request.type === "credit_note") {
    const note = await db.creditNote.findFirst({
      where: { bookingId: booking.id, ...(request.sourceId ? { id: request.sourceId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { lines: true, invoice: true },
    });
    if (!note) throw new RuleError("No credit note has been issued for this booking yet.");
    sourceId = note.id;
    data.reference = note.number;
    const supplier = note.invoice.supplier as unknown as SupplierSnapshot;
    const recipient = note.invoice.recipient as unknown as RecipientSnapshot;
    data.business = { ...data.business, gstin: null, address: null };
    data.creditNote = {
      number: note.number,
      date: formatDateKey(dateKey(note.issuedOn), "d MMM yyyy"),
      invoiceNumber: note.invoice.number,
      invoiceDate: formatDateKey(dateKey(note.invoice.issuedOn), "d MMM yyyy"),
      reason: note.reason,
      supplier: { legalName: supplier.legalName, gstin: supplier.gstin, address: supplier.address, state: gstStateLabel(supplier.stateCode), phone: null, email: null },
      recipient: { name: recipient.name, company: recipient.companyName, gstin: recipient.gstin, address: recipient.address, state: gstStateLabel(recipient.stateCode) },
      supplyType: note.supplyType,
      lines: note.lines.map((l) => ({
        description: l.description,
        functionLabel: null,
        sac: l.sacCode,
        quantity: "—",
        unit: "",
        rate: "—",
        discount: null,
        taxable: formatINR(l.taxableValue),
        taxRate: `${money(l.ratePercent).toString()}%`,
        cgst: formatINR(l.cgst),
        sgst: formatINR(l.sgst),
        igst: formatINR(l.igst),
        total: formatINR(l.lineTotal),
      })),
      totals: totals({ ...note, roundOff: "0", subtotal: undefined, discountTotal: undefined }),
    };
  }

  const suffix: Partial<Record<DocumentTypeKey, string>> = {
    booking_confirmation: "BC",
    payment_statement: "PS",
    deposit_settlement: "DS",
    function_sheet: "FS",
    kitchen_sheet: "KS",
    booking_summary: "SUM",
  };
  if (suffix[request.type]) data.reference = `${booking.reference}/${suffix[request.type]}`;
  if (request.type === "booking_confirmation" && !isFirm(booking.status)) data.draft = true;

  // Terms
  const terms: NonNullable<DocumentData["terms"]> = {};
  if (on("terms.payment")) terms.payment = docs.paymentTerms;
  if (on("terms.cancellation")) {
    const snapshot = booking.cancellationPolicySnapshot as { slabs?: unknown } | null;
    let slabs = parseSlabs(snapshot?.slabs);
    if (!slabs.length) {
      const { defaultCancellationPolicyId } = await getSettings("bookingPolicy");
      const policy = defaultCancellationPolicyId ? await db.cancellationPolicy.findUnique({ where: { id: defaultCancellationPolicyId } }) : null;
      slabs = parseSlabs(policy?.slabs);
    }
    terms.cancellation = cancellationText(slabs);
  }
  if (on("terms.conditions")) terms.conditions = docs.bookingConditions;
  if (on("bank.details")) terms.bank = docs.bankDetails;
  if (Object.keys(terms).length) data.terms = terms;

  // Notes
  const notes: NonNullable<DocumentData["notes"]> = {};
  if (on("notes.custom") && request.customNote?.trim()) notes.custom = request.customNote.trim().slice(0, 4000);
  if (on("notes.special")) {
    const special = [booking.notes, ...(on("event.functions") ? [] : activeFunctions.map((s) => (s.specialInstructions ? `${s.name}: ${s.specialInstructions}` : null)))].filter((v): v is string => !!v);
    if (special.length) notes.special = special;
  }
  if (on("notes.internal") && booking.internalInstructions) notes.internal = booking.internalInstructions;
  if (Object.keys(notes).length) data.notes = notes;

  return { data, sourceId };
}
