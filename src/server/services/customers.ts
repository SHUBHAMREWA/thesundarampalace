import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { safeFileName, sniffFileType } from "@/lib/files/sniff";
import { db } from "@/lib/db";
import { dateFromKey, dateKey, todayIST } from "@/lib/time";
import {
  optionalDateKey,
  optionalEmail,
  optionalPhone,
  optionalText,
  requiredText,
} from "@/lib/validation/forms";
import { phoneSchema } from "@/lib/validation/phone";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";
import {
  deletePrivateFile,
  putPrivateFile,
  readPrivateFile,
} from "@/server/storage/private";

import { recordActivity } from "./activity";
import { recordAudit } from "./audit";
import { bookingDeleteBlocker, softDeleteBooking } from "./bookings";
import { deleteCustomerPhoto, storeCustomerPhoto } from "./customer-photo";
import { fieldError, RuleError } from "./errors";
import { NotFoundError } from "./leads";
import { nextCustomerReference } from "./numbering";
import { getSettings } from "./settings";

/**
 * Customers (MASTER_PROMPT §8). Contact fields need `customers.read`;
 * date of birth, marital details and address need `customers.personal.read`
 * and are left out of every response otherwise. Identity documents need
 * `documents.sensitive.*` and every access is audit-logged.
 */

export const MARITAL_STATUSES = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const DOCUMENT_CATEGORIES = [
  { value: "PHOTO", label: "Photo" },
  { value: "AADHAAR_MASKED", label: "Aadhaar card" },
  { value: "PAN", label: "PAN card" },
  { value: "VOTER_ID", label: "Voter ID" },
  { value: "DRIVING_LICENCE", label: "Driving licence" },
  { value: "PASSPORT", label: "Passport" },
  { value: "OTHER", label: "Other document" },
] as const;

/**
 * The ID number as it may be stored. Aadhaar: only the last 4 digits are kept
 * (UIDAI rules; secure-customer-data skill). PAN must look like ABCDE1234F.
 */
export function normalizeIdNumber(
  category: string,
  raw: string | null,
): string | null {
  if (!raw) return null;
  if (category === "PHOTO") return null;
  if (category === "AADHAAR_MASKED") {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 12 && digits.length !== 4)
      fieldError(
        "idNumber",
        "Enter the 12-digit Aadhaar number or just its last 4 digits",
      );
    return `XXXX XXXX ${digits.slice(-4)}`;
  }
  const value = raw.toUpperCase().replace(/\s+/g, "");
  if (category === "PAN" && !/^[A-Z]{5}\d{4}[A-Z]$/.test(value))
    fieldError("idNumber", "A PAN looks like ABCDE1234F");
  if (!/^[A-Z0-9/-]{4,25}$/.test(value))
    fieldError("idNumber", "Use letters, digits, / or - only");
  return value;
}

export const CONSENT_PURPOSES = [
  { value: "marketing_whatsapp", label: "WhatsApp offers and updates" },
  { value: "marketing_email", label: "Email offers and updates" },
  { value: "sms", label: "SMS" },
  { value: "greetings", label: "Birthday and anniversary greetings" },
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]["value"];

const contactSchema = z.object({
  fullName: requiredText("Full name", 120),
  mobile: phoneSchema,
  whatsapp: optionalPhone,
  email: optionalEmail,
  companyName: optionalText(160),
  categoryKey: optionalText(50),
  professionKeys: z
    .array(z.string().trim().max(50))
    .max(10, "Choose at most 10 professions")
    .default([])
    .transform((keys) => [...new Set(keys.filter(Boolean))]),
  professionOther: optionalText(120),
  city: optionalText(80),
  notes: optionalText(4000),
});

const personalSchema = z.object({
  maritalStatus: z
    .enum(["", ...MARITAL_STATUSES.map((m) => m.value)] as [
      string,
      ...string[],
    ])
    .optional()
    .transform((v) => (v ? v : null)),
  dateOfBirth: optionalDateKey,
  approxAge: z
    .string()
    .trim()
    .optional()
    .refine(
      (v) => !v || (/^\d{1,3}$/.test(v) && Number(v) >= 1 && Number(v) <= 110),
      "Enter an age between 1 and 110",
    )
    .transform((v) => (v ? Number(v) : null)),
  anniversary: optionalDateKey,
  spouseName: optionalText(120),
  locality: optionalText(120),
  address: optionalText(500),
  mapsUrl: z
    .string()
    .trim()
    .max(500, "At most 500 characters")
    .optional()
    .refine(
      (v) => !v || isGoogleMapsUrl(v),
      "Paste a Google Maps link (google.com/maps or maps.app.goo.gl)",
    )
    .transform((v) => (v ? v : null)),
});

export const customerSchema = contactSchema.extend(personalSchema.shape);
export type CustomerInput = z.infer<typeof customerSchema>;

/** Columns hidden from staff without `customers.personal.read`. */
const PERSONAL_KEYS = [
  "maritalStatus",
  "dateOfBirth",
  "approxBirthYear",
  "anniversary",
  "spouseName",
  "locality",
  "address",
  "mapsUrl",
  "photoKey",
] as const;

const MAPS_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "google.co.in",
  "www.google.co.in",
  "maps.google.com",
  "goo.gl",
  "maps.app.goo.gl",
]);

/** Only https Google Maps links, so the "Open map" button never points elsewhere. */
export function isGoogleMapsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || !MAPS_HOSTS.has(url.hostname)) return false;
  if (url.hostname === "maps.google.com" || url.hostname === "maps.app.goo.gl")
    return true;
  return url.pathname.startsWith("/maps");
}

/** Exact age from the date of birth, else an approximate one from the birth year. */
export function customerAge(
  customer: { dateOfBirth?: Date | null; approxBirthYear?: number | null },
  today: string = todayIST(),
): { years: number; approximate: boolean } | null {
  const exact = ageOn(customer.dateOfBirth ?? null, today);
  if (exact !== null) return { years: exact, approximate: false };
  if (!customer.approxBirthYear) return null;
  const years = Number(today.slice(0, 4)) - customer.approxBirthYear;
  return years >= 0 ? { years, approximate: true } : null;
}

/** Age in whole years, computed (never stored). */
export function ageOn(
  dateOfBirth: Date | null,
  today: string = todayIST(),
): number | null {
  if (!dateOfBirth) return null;
  const dob = dateKey(dateOfBirth);
  let age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  if (today.slice(5) < dob.slice(5)) age -= 1;
  return age >= 0 ? age : null;
}

function visibleWhere(): Prisma.CustomerWhereInput {
  return { deletedAt: null };
}

/** Removes personal fields the actor may not see. */
export function shapeCustomer<T extends Record<string, unknown>>(
  actor: Actor,
  customer: T,
): T {
  if (can(actor, "customers.personal.read")) return customer;
  const copy: Record<string, unknown> = { ...customer };
  for (const key of PERSONAL_KEYS) delete copy[key];
  return copy as T;
}

export const CUSTOMER_PAGE_SIZE = 25;

export const customerListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().max(50).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

function searchWhere(q: string | undefined): Prisma.CustomerWhereInput[] {
  if (!q) return [];
  const digits = q.replace(/\D/g, "");
  return [
    {
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { reference: { contains: q.toUpperCase() } },
        { companyName: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 4
          ? [
              { mobile: { contains: digits } },
              { whatsapp: { contains: digits } },
            ]
          : []),
      ],
    },
  ];
}

export async function listCustomers(
  actor: Actor,
  query: z.infer<typeof customerListQuerySchema>,
) {
  assertPermission(actor, "customers.read");
  const where: Prisma.CustomerWhereInput = {
    AND: [
      visibleWhere(),
      ...searchWhere(query.q),
      ...(query.category ? [{ categoryKey: query.category }] : []),
    ],
  };
  const [total, rows] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * CUSTOMER_PAGE_SIZE,
      take: CUSTOMER_PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        fullName: true,
        mobile: true,
        whatsapp: true,
        email: true,
        city: true,
        categoryKey: true,
        companyName: true,
        createdAt: true,
        _count: { select: { bookings: { where: { deletedAt: null } } } },
        // Bookings that stop the customer from being deleted (see deleteCustomer).
        bookings: {
          where: {
            deletedAt: null,
            status: { in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED"] },
          },
          select: { reference: true },
          take: 1,
        },
      },
    }),
  ]);
  return {
    total,
    rows,
    pageCount: Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE)),
  };
}

/** Quick search for the booking wizard (name, mobile or reference). */
export async function searchCustomers(actor: Actor, q: string, take = 8) {
  assertPermission(actor, "customers.read");
  if (q.trim().length < 2) return [];
  return db.customer.findMany({
    where: { AND: [visibleWhere(), ...searchWhere(q.trim())] },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      reference: true,
      fullName: true,
      mobile: true,
      city: true,
    },
  });
}

/**
 * Customers to pick from when starting a booking: matches for `q`, or the
 * most recently active customers when nothing has been typed yet.
 */
export async function customerPicker(actor: Actor, q: string, take = 20) {
  assertPermission(actor, "customers.read");
  const query = q.trim();
  return db.customer.findMany({
    where: {
      AND: [visibleWhere(), ...(query.length >= 2 ? searchWhere(query) : [])],
    },
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      reference: true,
      fullName: true,
      mobile: true,
      city: true,
      categoryKey: true,
      _count: { select: { bookings: { where: { deletedAt: null } } } },
    },
  });
}

export async function getCustomer(actor: Actor, id: string) {
  assertPermission(actor, "customers.read");
  const customer = await db.customer.findFirst({
    where: { id, ...visibleWhere() },
    include: {
      leads: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          statusKey: true,
          eventTypeKey: true,
          preferredDate: true,
          createdAt: true,
        },
      },
      bookings: {
        where: { deletedAt: null },
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          reference: true,
          mainEventName: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      },
    },
  });
  if (!customer) throw new NotFoundError("Customer");
  const documents = can(actor, "documents.sensitive.read")
    ? await db.customerDocument.findMany({
        where: { customerId: id, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          category: true,
          label: true,
          idNumber: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          partyId: true,
          purpose: true,
          createdAt: true,
        },
      })
    : null;
  const consents = await latestConsents("CUSTOMER", id);
  const pendingDuplicates = await db.customerMergeReview.count({
    where: { status: "PENDING", OR: [{ primaryId: id }, { duplicateId: id }] },
  });
  return {
    customer: shapeCustomer(actor, customer),
    documents,
    consents,
    pendingDuplicates,
  };
}

async function requireCustomer(id: string) {
  const customer = await db.customer.findFirst({
    where: { id, ...visibleWhere() },
  });
  if (!customer) throw new NotFoundError("Customer");
  return customer;
}

/**
 * Removes a customer from the CRM (soft delete: the row stays for the audit
 * trail). Customers with any booking can't be deleted, because bookings,
 * payments and invoices must keep their customer.
 */
export async function deleteCustomer(actor: Actor, id: string, reason: string) {
  assertPermission(actor, "customers.delete");
  const customer = await requireCustomer(id);
  // Bookings go with the customer, but only ones that could be deleted on their own.
  const bookings = await db.booking.findMany({
    where: { customerId: id, deletedAt: null },
    select: { id: true, reference: true, status: true },
  });
  if (bookings.length) assertPermission(actor, "bookings.delete");
  for (const b of bookings) {
    const blocker = await bookingDeleteBlocker(b.id, b.status);
    if (blocker)
      throw new RuleError(
        `${customer.fullName} can't be deleted because of booking ${b.reference}: ${blocker}`,
      );
  }
  await db.$transaction(
    async (tx) => {
      for (const b of bookings)
        await softDeleteBooking(
          tx,
          b,
          actor.id,
          `Customer ${customer.reference} deleted: ${reason}`,
        );
      await tx.customer.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      await recordActivity(
        {
          entityType: "customer",
          entityId: id,
          actorId: actor.id,
          kind: "DELETED",
          message: `Deleted: ${reason.slice(0, 200)}`,
        },
        tx,
      );
      await recordAudit(
        {
          actorId: actor.id,
          action: "customer.deleted",
          entityType: "customer",
          entityId: id,
          summary: {
            reference: customer.reference,
            reason: reason.slice(0, 200),
            bookingsDeleted: bookings.map((b) => b.reference),
          },
        },
        tx,
      );
    },
    { timeout: 30_000 },
  );
}

export class DuplicateCustomerError extends RuleError {
  constructor(
    readonly existing: { id: string; reference: string; fullName: string },
  ) {
    super(
      `${existing.fullName} (${existing.reference}) already has this mobile number.`,
    );
    this.name = "DuplicateCustomerError";
  }
}

async function validateLookups(input: {
  categoryKey: string | null;
  professionKeys: string[];
}) {
  if (input.categoryKey) {
    const exists = await db.lookupValue.findFirst({
      where: {
        listKey: "customer_category",
        key: input.categoryKey,
        active: true,
      },
    });
    if (!exists) fieldError("categoryKey", "Choose a value from the list");
  }
  if (input.professionKeys.length) {
    const found = await db.lookupValue.count({
      where: {
        listKey: "profession",
        key: { in: input.professionKeys },
        active: true,
      },
    });
    if (found !== input.professionKeys.length)
      fieldError("professionKeys", "Choose professions from the list");
  }
}

function personalData(input: CustomerInput) {
  return {
    maritalStatus: input.maritalStatus,
    dateOfBirth: input.dateOfBirth ? dateFromKey(input.dateOfBirth) : null,
    approxBirthYear:
      !input.dateOfBirth && input.approxAge
        ? Number(todayIST().slice(0, 4)) - input.approxAge
        : null,
    anniversary:
      input.maritalStatus === "married" && input.anniversary
        ? dateFromKey(input.anniversary)
        : null,
    spouseName: input.maritalStatus === "married" ? input.spouseName : null,
    locality: input.locality,
    address: input.address,
    mapsUrl: input.mapsUrl,
  };
}

function contactData(input: CustomerInput) {
  return {
    fullName: input.fullName,
    mobile: input.mobile,
    whatsapp: input.whatsapp,
    email: input.email,
    companyName: input.companyName,
    categoryKey: input.categoryKey,
    professionKeys: input.professionKeys,
    professionOther: input.professionKeys.includes("other")
      ? input.professionOther
      : null,
    city: input.city,
    notes: input.notes,
  };
}

/**
 * Creates a customer. Same mobile as an existing customer → refused with a
 * link to the existing record, unless the user explicitly creates it anyway;
 * then a merge review is opened so a manager decides later.
 */
export async function createCustomer(
  actor: Actor,
  input: CustomerInput,
  options: {
    allowDuplicate?: boolean;
    leadId?: string;
    whatsappOptIn?: boolean;
  } = {},
) {
  assertPermission(actor, "customers.edit");
  const { consentNoticeVersion } = await getSettings("enquiry");
  await validateLookups(input);
  const existing = await db.customer.findFirst({
    where: { mobile: input.mobile, ...visibleWhere() },
    select: { id: true, reference: true, fullName: true },
  });
  if (existing && !options.allowDuplicate)
    throw new DuplicateCustomerError(existing);
  const numbering = await getSettings("numbering");
  const personal = can(actor, "customers.personal.read")
    ? personalData(input)
    : {};
  return db.$transaction(async (tx) => {
    const reference = await nextCustomerReference(
      tx,
      new Date(),
      numbering.customerPrefix,
    );
    const customer = await tx.customer.create({
      data: {
        reference,
        ...contactData(input),
        ...personal,
        createdById: actor.id,
      },
    });
    if (options.whatsappOptIn) {
      await tx.consentRecord.create({
        data: {
          subjectType: "CUSTOMER",
          subjectId: customer.id,
          purpose: "marketing_whatsapp",
          granted: true,
          noticeVersion: consentNoticeVersion,
          source: "Agreed when added (New customer form)",
        },
      });
    }
    if (existing) {
      await tx.customerMergeReview.create({
        data: {
          primaryId: existing.id,
          duplicateId: customer.id,
          reason: "SAME_MOBILE",
          createdById: actor.id,
        },
      });
    }
    if (options.leadId) {
      await tx.lead.update({
        where: { id: options.leadId },
        data: { customerId: customer.id, lastActivityAt: new Date() },
      });
      await tx.leadActivity.create({
        data: {
          leadId: options.leadId,
          kind: "NOTE",
          actorId: actor.id,
          note: `Converted to customer ${reference}`,
        },
      });
    }
    await recordActivity(
      {
        entityType: "customer",
        entityId: customer.id,
        actorId: actor.id,
        kind: "CREATED",
        message: options.leadId
          ? "Customer created from a lead"
          : "Customer created",
      },
      tx,
    );
    await recordAudit(
      {
        actorId: actor.id,
        action: "customer.created",
        entityType: "customer",
        entityId: customer.id,
        summary: { reference, duplicateOf: existing?.reference ?? null },
      },
      tx,
    );
    return customer;
  });
}

export async function updateCustomer(
  actor: Actor,
  id: string,
  input: CustomerInput,
) {
  assertPermission(actor, "customers.edit");
  const before = await requireCustomer(id);
  await validateLookups(input);
  const personal = can(actor, "customers.personal.read")
    ? personalData(input)
    : {};
  const data = { ...contactData(input), ...personal };
  const changed = Object.entries(data as Record<string, unknown>)
    .filter(([key, value]) => {
      const old = (before as Record<string, unknown>)[key];
      const norm = (v: unknown) =>
        v instanceof Date
          ? dateKey(v)
          : Array.isArray(v)
            ? v.join(",")
            : (v ?? null);
      return norm(old) !== norm(value);
    })
    .map(([key]) => key);
  if (!changed.length) return;
  if (changed.includes("mobile")) {
    const clash = await db.customer.findFirst({
      where: { mobile: input.mobile, id: { not: id }, ...visibleWhere() },
      select: { reference: true, fullName: true },
    });
    if (clash)
      fieldError(
        "mobile",
        `${clash.fullName} (${clash.reference}) already has this mobile number`,
      );
  }
  await db.$transaction(async (tx) => {
    await tx.customer.update({ where: { id }, data });
    await recordActivity(
      {
        entityType: "customer",
        entityId: id,
        actorId: actor.id,
        kind: "UPDATED",
        message: `Updated: ${changed.join(", ")}`,
        data: { fields: changed },
      },
      tx,
    );
    // Field names only — never the personal values themselves.
    await recordAudit(
      {
        actorId: actor.id,
        action: "customer.updated",
        entityType: "customer",
        entityId: id,
        summary: { fields: changed },
      },
      tx,
    );
  });
}

// ─── Consent ─────────────────────────────────────────────────────────────────

export async function latestConsents(
  subjectType: "CUSTOMER" | "PARTY" | "LEAD",
  subjectId: string,
) {
  const rows = await db.consentRecord.findMany({
    where: { subjectType, subjectId },
    orderBy: { createdAt: "desc" },
  });
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows)
    if (!latest.has(row.purpose)) latest.set(row.purpose, row);
  return latest;
}

/** Records a consent change (a new row; the latest row wins). */
export async function setCustomerConsent(
  actor: Actor,
  id: string,
  purpose: ConsentPurpose,
  granted: boolean,
  source: string,
) {
  assertPermission(actor, "customers.edit");
  await requireCustomer(id);
  if (!CONSENT_PURPOSES.some((p) => p.value === purpose))
    fieldError("purpose", "Unknown purpose");
  const { consentNoticeVersion } = await getSettings("enquiry");
  await db.$transaction(async (tx) => {
    await tx.consentRecord.create({
      data: {
        subjectType: "CUSTOMER",
        subjectId: id,
        purpose,
        granted,
        noticeVersion: consentNoticeVersion,
        source: source.slice(0, 120),
      },
    });
    await recordActivity(
      {
        entityType: "customer",
        entityId: id,
        actorId: actor.id,
        kind: "CONSENT",
        message: `${granted ? "Opted in to" : "Opted out of"} ${CONSENT_PURPOSES.find((p) => p.value === purpose)?.label ?? purpose}`,
      },
      tx,
    );
  });
}

// ─── Leads → customers ───────────────────────────────────────────────────────

/** Links a lead to the existing customer with the same mobile, or creates one. */
export async function convertLeadToCustomer(actor: Actor, leadId: string) {
  assertPermission(actor, "customers.edit");
  assertPermission(actor, "leads.edit");
  const lead = await db.lead.findFirst({
    where: { id: leadId, deletedAt: null },
  });
  if (!lead) throw new NotFoundError("Lead");
  if (lead.customerId) return { customerId: lead.customerId, created: false };
  const existing = await db.customer.findFirst({
    where: { mobile: lead.phone, ...visibleWhere() },
  });
  if (existing) {
    await db.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: lead.id },
        data: { customerId: existing.id, lastActivityAt: new Date() },
      });
      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          kind: "NOTE",
          actorId: actor.id,
          note: `Linked to existing customer ${existing.reference}`,
        },
      });
      await recordActivity(
        {
          entityType: "customer",
          entityId: existing.id,
          actorId: actor.id,
          kind: "LEAD_LINKED",
          message: `Lead ${lead.reference} linked`,
        },
        tx,
      );
    });
    return { customerId: existing.id, created: false };
  }
  const input = customerSchema.parse({
    fullName: lead.fullName,
    mobile: lead.phone,
    email: lead.email ?? "",
  });
  const customer = await createCustomer(actor, input, { leadId: lead.id });
  return { customerId: customer.id, created: true };
}

// ─── Duplicates and merging ──────────────────────────────────────────────────

export async function listMergeReviews(actor: Actor) {
  assertPermission(actor, "customers.merge");
  const reviews = await db.customerMergeReview.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const ids = [
    ...new Set(reviews.flatMap((r) => [r.primaryId, r.duplicateId])),
  ];
  const customers = await db.customer.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      reference: true,
      fullName: true,
      mobile: true,
      email: true,
      city: true,
      createdAt: true,
      deletedAt: true,
      _count: { select: { bookings: true, leads: true } },
    },
  });
  const byId = new Map(customers.map((c) => [c.id, c]));
  return reviews
    .map((r) => ({
      ...r,
      primary: byId.get(r.primaryId),
      duplicate: byId.get(r.duplicateId),
    }))
    .filter(
      (r) =>
        r.primary &&
        r.duplicate &&
        !r.primary.deletedAt &&
        !r.duplicate.deletedAt,
    );
}

/** Flags two customers for review (e.g. spotted by staff). */
export async function flagPossibleDuplicate(
  actor: Actor,
  primaryId: string,
  duplicateId: string,
) {
  assertPermission(actor, "customers.edit");
  if (primaryId === duplicateId)
    throw new RuleError("Choose two different customers.");
  await Promise.all([requireCustomer(primaryId), requireCustomer(duplicateId)]);
  await db.customerMergeReview.upsert({
    where: { primaryId_duplicateId: { primaryId, duplicateId } },
    update: { status: "PENDING" },
    create: { primaryId, duplicateId, reason: "MANUAL", createdById: actor.id },
  });
}

/**
 * Moves leads, bookings and documents from the duplicate to the primary
 * record, fills empty fields on the primary, and soft-deletes the duplicate.
 * Bookings keep their references; nothing financial is edited.
 */
export async function mergeCustomers(
  actor: Actor,
  reviewId: string,
  keepId: string,
) {
  assertPermission(actor, "customers.merge");
  const review = await db.customerMergeReview.findUnique({
    where: { id: reviewId },
  });
  if (!review || review.status !== "PENDING")
    throw new NotFoundError("Duplicate review");
  if (keepId !== review.primaryId && keepId !== review.duplicateId)
    throw new RuleError("Choose which record to keep.");
  const removeId =
    keepId === review.primaryId ? review.duplicateId : review.primaryId;
  const [keep, remove] = await Promise.all([
    requireCustomer(keepId),
    requireCustomer(removeId),
  ]);
  const fill: Record<string, unknown> = {};
  for (const key of [
    "whatsapp",
    "email",
    "gstin",
    "companyName",
    "categoryKey",
    "professionOther",
    "stateCode",
    "city",
    "locality",
    "address",
    "mapsUrl",
    "maritalStatus",
    "dateOfBirth",
    "approxBirthYear",
    "anniversary",
    "spouseName",
    "photoKey",
  ] as const) {
    if (
      (keep as Record<string, unknown>)[key] == null &&
      (remove as Record<string, unknown>)[key] != null
    )
      fill[key] = (remove as Record<string, unknown>)[key];
  }
  if (!keep.professionKeys.length && remove.professionKeys.length)
    fill.professionKeys = remove.professionKeys;
  // The removed record's photo moves over, or is deleted when the kept record has its own.
  const orphanPhoto = keep.photoKey && remove.photoKey ? remove.photoKey : null;
  if (remove.notes)
    fill.notes = [
      keep.notes,
      `Merged from ${remove.reference}: ${remove.notes}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  await db.$transaction(async (tx) => {
    const [leads, bookings, documents] = await Promise.all([
      tx.lead.updateMany({
        where: { customerId: removeId },
        data: { customerId: keepId },
      }),
      tx.booking.updateMany({
        where: { customerId: removeId },
        data: { customerId: keepId },
      }),
      tx.customerDocument.updateMany({
        where: { customerId: removeId },
        data: { customerId: keepId },
      }),
    ]);
    await tx.consentRecord.updateMany({
      where: { subjectType: "CUSTOMER", subjectId: removeId },
      data: { subjectId: keepId },
    });
    await tx.customer.update({ where: { id: keepId }, data: fill });
    await tx.customer.update({
      where: { id: removeId },
      data: { deletedAt: new Date(), mergedIntoId: keepId, photoKey: null },
    });
    await tx.customerMergeReview.update({
      where: { id: review.id },
      data: { status: "MERGED", decidedById: actor.id, decidedAt: new Date() },
    });
    await tx.customerMergeReview.updateMany({
      where: {
        status: "PENDING",
        OR: [{ primaryId: removeId }, { duplicateId: removeId }],
      },
      data: {
        status: "DISMISSED",
        decidedById: actor.id,
        decidedAt: new Date(),
        note: `Merged into ${keep.reference}`,
      },
    });
    await recordActivity(
      {
        entityType: "customer",
        entityId: keepId,
        actorId: actor.id,
        kind: "MERGED",
        message: `Merged ${remove.reference} into this record (${bookings.count} bookings, ${leads.count} leads, ${documents.count} documents moved)`,
      },
      tx,
    );
    await recordAudit(
      {
        actorId: actor.id,
        action: "customer.merged",
        entityType: "customer",
        entityId: keepId,
        summary: {
          kept: keep.reference,
          removed: remove.reference,
          bookings: bookings.count,
          leads: leads.count,
          documents: documents.count,
        },
      },
      tx,
    );
  });
  if (orphanPhoto) await deleteCustomerPhoto(orphanPhoto);
  return { keptId: keepId };
}

export async function dismissMergeReview(
  actor: Actor,
  reviewId: string,
  note: string | null,
) {
  assertPermission(actor, "customers.merge");
  const review = await db.customerMergeReview.findUnique({
    where: { id: reviewId },
  });
  if (!review || review.status !== "PENDING")
    throw new NotFoundError("Duplicate review");
  await db.customerMergeReview.update({
    where: { id: reviewId },
    data: {
      status: "DISMISSED",
      decidedById: actor.id,
      decidedAt: new Date(),
      note,
    },
  });
  await recordAudit({
    actorId: actor.id,
    action: "customer.merge_dismissed",
    entityType: "customer",
    entityId: review.primaryId,
    summary: { duplicateId: review.duplicateId },
  });
}

// ─── Private documents ───────────────────────────────────────────────────────

export const documentUploadSchema = z.object({
  category: z.enum(
    DOCUMENT_CATEGORIES.map((c) => c.value) as [string, ...string[]],
    { error: "Choose a document type" },
  ),
  label: optionalText(120),
  idNumber: optionalText(40),
  purpose: requiredText("Purpose", 200),
  partyId: optionalText(50),
});

const SENSITIVE_CATEGORIES = new Set([
  "PAN",
  "AADHAAR_MASKED",
  "VOTER_ID",
  "DRIVING_LICENCE",
  "PASSPORT",
  "OTHER",
  "PHOTO",
]);

/**
 * Stores an identity document or photo in the private store. Type is checked
 * by content; size by Settings. The purpose is required (data minimisation).
 */
export async function uploadCustomerDocument(
  actor: Actor,
  customerId: string,
  input: z.infer<typeof documentUploadSchema>,
  file: { name: string; bytes: Uint8Array },
) {
  assertPermission(actor, "documents.sensitive.upload");
  const customer = await requireCustomer(customerId);
  const { maxUploadMb } = await getSettings("documents");
  if (file.bytes.byteLength === 0) fieldError("file", "Choose a file");
  if (file.bytes.byteLength > maxUploadMb * 1024 * 1024)
    fieldError("file", `Files must be ${maxUploadMb} MB or smaller`);
  const type = sniffFileType(file.bytes);
  if (!type) fieldError("file", "Upload a JPEG, PNG, WebP or PDF file");
  const idNumber = normalizeIdNumber(input.category, input.idNumber);
  if (input.partyId) {
    const party = await db.brideGroomParty.findFirst({
      where: { id: input.partyId, booking: { customerId } },
    });
    if (!party)
      fieldError(
        "partyId",
        "Choose the bride or groom of one of this customer's bookings",
      );
  }
  // Photos go to Cloudinary (network), so store the bytes before the transaction.
  const stored = await putPrivateFile(file.bytes, type.mime);
  const ext = stored.mimeType === "image/webp" ? "webp" : type.ext;
  return db
    .$transaction(async (tx) => {
      const doc = await tx.customerDocument.create({
        data: {
          customerId: customer.id,
          partyId: input.partyId,
          category: input.category,
          label: input.label,
          idNumber,
          purpose: input.purpose,
          storageKey: stored.storageKey,
          fileName: safeFileName(file.name, ext),
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          sha256: stored.sha256,
          uploadedById: actor.id,
        },
      });
      await recordAudit(
        {
          actorId: actor.id,
          action: "document.uploaded",
          entityType: "customer_document",
          entityId: doc.id,
          summary: {
            customer: customer.reference,
            category: input.category,
            sizeBytes: stored.sizeBytes,
          },
        },
        tx,
      );
      await recordActivity(
        {
          entityType: "customer",
          entityId: customer.id,
          actorId: actor.id,
          kind: "DOCUMENT",
          message: `Uploaded ${DOCUMENT_CATEGORIES.find((c) => c.value === input.category)?.label ?? "document"}`,
        },
        tx,
      );
      return doc;
    })
    .catch(async (error) => {
      await deletePrivateFile(stored.storageKey);
      throw error;
    });
}

/** Private documents of a booking's bride and groom, by party (needs `documents.sensitive.read`). */
export async function partyDocuments(actor: Actor, bookingId: string) {
  if (!can(actor, "documents.sensitive.read")) return null;
  const docs = await db.customerDocument.findMany({
    where: { deletedAt: null, party: { bookingId } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      partyId: true,
      category: true,
      label: true,
      idNumber: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
  const byParty = new Map<string, typeof docs>();
  for (const d of docs)
    byParty.set(d.partyId!, [...(byParty.get(d.partyId!) ?? []), d]);
  return byParty;
}

/** Returns the bytes for a permitted download and writes the audit entry. */
export async function readCustomerDocument(
  actor: Actor,
  documentId: string,
  meta: { ip?: string | null; userAgent?: string | null },
  options: { thumbnail?: boolean } = {},
) {
  assertPermission(actor, "documents.sensitive.read");
  const doc = await db.customerDocument.findFirst({
    where: { id: documentId, deletedAt: null },
    include: { customer: { select: { reference: true, deletedAt: true } } },
  });
  if (!doc || doc.customer.deletedAt) throw new NotFoundError("Document");
  // Thumbnails are a small copy of the photo (PDFs and database-stored photos come back whole).
  const bytes = await readPrivateFile(
    doc.storageKey,
    undefined,
    options.thumbnail ? "w_480,c_limit" : undefined,
  );
  if (!bytes) throw new NotFoundError("Document file");
  await recordAudit({
    actorId: actor.id,
    action: options.thumbnail ? "document.previewed" : "document.viewed",
    entityType: "customer_document",
    entityId: doc.id,
    summary: {
      customer: doc.customer.reference,
      category: doc.category,
      sensitive: SENSITIVE_CATEGORIES.has(doc.category),
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { bytes, fileName: doc.fileName, mimeType: doc.mimeType };
}

/** Deletes the file bytes and keeps the metadata row (with who and when). */
export async function deleteCustomerDocument(
  actor: Actor,
  documentId: string,
  reason: string,
) {
  assertPermission(actor, "documents.sensitive.upload");
  const doc = await db.customerDocument.findFirst({
    where: { id: documentId, deletedAt: null },
  });
  if (!doc) throw new NotFoundError("Document");
  if (!reason.trim()) fieldError("reason", "Give a reason");
  await db.$transaction(async (tx) => {
    await tx.customerDocument.update({
      where: { id: doc.id },
      data: { deletedAt: new Date(), deletedById: actor.id },
    });
    await recordAudit(
      {
        actorId: actor.id,
        action: "document.deleted",
        entityType: "customer_document",
        entityId: doc.id,
        summary: { reason: reason.slice(0, 300), category: doc.category },
      },
      tx,
    );
    await recordActivity(
      {
        entityType: "customer",
        entityId: doc.customerId,
        actorId: actor.id,
        kind: "DOCUMENT",
        message: "Deleted a document",
      },
      tx,
    );
  });
  // After the record is marked deleted, so a slow Cloudinary call can't break the transaction.
  await deletePrivateFile(doc.storageKey);
}

// ─── Photo ───────────────────────────────────────────────────────────────────

/**
 * Sets, replaces or removes the customer's photo. The new photo is stored
 * first; the old one is deleted from Cloudinary (or the database) only after
 * the record points at the new one.
 */
export async function setCustomerPhoto(
  actor: Actor,
  id: string,
  change: { file: File | null; remove: boolean },
) {
  if (!change.file && !change.remove) return;
  assertPermission(actor, "customers.edit");
  assertPermission(actor, "customers.personal.read");
  const before = await requireCustomer(id);
  if (!change.file && !before.photoKey) return;
  const photoKey = change.file ? await storeCustomerPhoto(change.file) : null;
  try {
    await db.$transaction(async (tx) => {
      await tx.customer.update({ where: { id }, data: { photoKey } });
      const message = photoKey
        ? before.photoKey
          ? "Photo changed"
          : "Photo added"
        : "Photo removed";
      await recordActivity(
        {
          entityType: "customer",
          entityId: id,
          actorId: actor.id,
          kind: "UPDATED",
          message,
          data: { fields: ["photo"] },
        },
        tx,
      );
      await recordAudit(
        {
          actorId: actor.id,
          action: "customer.photo_updated",
          entityType: "customer",
          entityId: id,
          summary: {
            removed: !photoKey,
            replaced: Boolean(photoKey && before.photoKey),
          },
        },
        tx,
      );
    });
  } catch (error) {
    if (photoKey) await deleteCustomerPhoto(photoKey);
    throw error;
  }
  if (before.photoKey) await deleteCustomerPhoto(before.photoKey);
}

/** The profile photo bytes for the photo route (needs `customers.personal.read`). */
export async function readCustomerPhoto(actor: Actor, id: string) {
  assertPermission(actor, "customers.personal.read");
  const customer = await db.customer.findFirst({
    where: { id, ...visibleWhere() },
    select: { photoKey: true },
  });
  if (!customer?.photoKey) throw new NotFoundError("Photo");
  const bytes = await readPrivateFile(customer.photoKey);
  if (!bytes) throw new NotFoundError("Photo");
  const type = sniffFileType(new Uint8Array(bytes));
  return { bytes, mimeType: type?.mime ?? "image/webp" };
}
