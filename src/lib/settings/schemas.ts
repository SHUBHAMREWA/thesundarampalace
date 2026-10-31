import { z } from "zod";

/**
 * Typed settings sections stored in `site_setting`. Business facts default to
 * null and are filled in by the business (docs/missing-business-info.md);
 * policy numbers marked "default" are editable placeholders, not facts.
 */

const nullableText = z
  .string()
  .trim()
  .max(2000)
  .nullable()
  .transform((v) => (v ? v : null));

const nullableUrl = z
  .union([z.url({ protocol: /^https$/ }), z.literal(""), z.null()])
  .transform((v) => (v ? v : null));

const localizedNullable = z
  .object({
    en: z.string().trim().max(4000),
    hi: z.string().trim().max(4000).optional(),
  })
  .nullable()
  .transform((v) =>
    v && (v.en || v.hi) ? { en: v.en, ...(v.hi ? { hi: v.hi } : {}) } : null,
  );

export const businessSettingsSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  legalName: nullableText,
  address: nullableText,
  city: nullableText,
  /** E.164, validated by the settings form with the shared phone schema. */
  phone: nullableText,
  whatsapp: nullableText,
  email: z
    .union([z.email(), z.literal(""), z.null()])
    .transform((v) => (v ? v : null)),
  officeHours: nullableText,
  timeZone: z.literal("Asia/Kolkata"),
  currency: z.literal("INR"),
});

export const contactSettingsSchema = z.object({
  /** Google Maps "Embed a map" URL (https://www.google.com/maps/embed?pb=…). */
  mapEmbedUrl: nullableUrl,
  mapLink: nullableUrl,
  directions: localizedNullable,
  whatsappMessage: localizedNullable,
  googleReviewsUrl: nullableUrl,
  instagramUrl: nullableUrl,
  facebookUrl: nullableUrl,
  youtubeUrl: nullableUrl,
  /** Google Search Console HTML-tag verification code (the content="…" value). */
  googleSiteVerification: nullableText,
});

const referencePrefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]+(-[A-Z0-9]+)*$/, "Letters, digits and hyphens only")
  .max(8);

/**
 * GST invoice numbers may have at most 16 characters (letters, digits, "-"
 * and "/"). Ours are PREFIX/26-27/0001, so the prefix is kept to 4 characters.
 * The accountant confirms the format before the first real invoice.
 */
const gstDocumentPrefix = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{1,4}$/, "1–4 letters or digits");

export const numberingSettingsSchema = z.object({
  leadPrefix: referencePrefix,
  bookingPrefix: referencePrefix,
  customerPrefix: referencePrefix,
  receiptPrefix: referencePrefix,
  invoicePrefix: gstDocumentPrefix,
  creditNotePrefix: gstDocumentPrefix,
});

export const enquirySettingsSchema = z.object({
  /** Same phone within this many days updates the open lead (default; confirm). */
  duplicateWindowDays: z.number().int().min(0).max(365),
  /** Shown on the enquiry success screen; null until the business supplies it. */
  responseTimePromise: localizedNullable,
  /** New leads are assigned to this staff member (null = unassigned). */
  defaultAssigneeId: z.string().nullable(),
  /** Bump when the consent wording changes; stored with every consent record. */
  consentNoticeVersion: z.string().min(1).max(40),
});

const percent = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a percentage, e.g. 25")
  .refine((v) => Number(v) <= 100, "At most 100%");

/**
 * Booking policy numbers. Every default here is an editable placeholder, not
 * a business fact: the owner confirms them (docs/missing-business-info.md §4).
 */
export const bookingPolicySettingsSchema = z.object({
  /** Tentative hold duration in hours (default 72; confirm with business). */
  holdDurationHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 30),
  holdReminderHoursBefore: z.number().int().min(0).max(72),
  /** Guaranteed plates lock this many days before each function. */
  guestCountLockDays: z.number().int().min(0).max(90),
  /** Suggested advance on confirmation, as a percentage of the accepted total (null = no suggestion). */
  advancePercent: percent.nullable(),
  /** Days a quotation stays valid (printed on the quotation). */
  quotationValidityDays: z.number().int().min(1).max(365),
  /** Cancellation policy snapshotted onto bookings at confirmation. */
  defaultCancellationPolicyId: z.string().nullable(),
  /** Refund the shortfall when fewer plates are served than guaranteed. */
  refundPlateShortfall: z.boolean(),
});

/** Totals and invoice wording. The business charges no GST (owner decision, 26 Oct 2026). */
export const taxSettingsSchema = z.object({
  /** Round quotation and invoice grand totals to the nearest rupee (difference shown as round-off). */
  roundGrandTotal: z.boolean(),
  /** Printed under invoice totals, e.g. "Whether tax is payable under reverse charge: No". */
  invoiceNotes: nullableText,
});

/** Wording printed on generated documents. */
export const documentSettingsSchema = z.object({
  /** Short line under the business name in document headers. */
  tagline: nullableText,
  footerText: nullableText,
  quotationTerms: nullableText,
  paymentTerms: nullableText,
  bookingConditions: nullableText,
  /** Bank details printed on quotations and statements (e.g. account name, number, IFSC, UPI ID). */
  bankDetails: nullableText,
  /**
   * Largest private document (ID copy, photo) staff may upload, in MB. Stored
   * in the database. At most 4: Vercel rejects request bodies over 4.5 MB.
   */
  maxUploadMb: z.number().int().min(1).max(4),
});

export const SETTINGS_SECTIONS = {
  business: businessSettingsSchema,
  contact: contactSettingsSchema,
  numbering: numberingSettingsSchema,
  enquiry: enquirySettingsSchema,
  bookingPolicy: bookingPolicySettingsSchema,
  tax: taxSettingsSchema,
  documents: documentSettingsSchema,
} as const;

export type SettingsSectionKey = keyof typeof SETTINGS_SECTIONS;
export type SettingsSection<K extends SettingsSectionKey> = z.infer<
  (typeof SETTINGS_SECTIONS)[K]
>;

export const DEFAULT_SETTINGS: {
  [K in SettingsSectionKey]: SettingsSection<K>;
} = {
  business: {
    displayName: "The Sundaram Palace",
    legalName: null,
    address: null,
    city: null,
    phone: null,
    whatsapp: null,
    email: null,
    officeHours: null,
    timeZone: "Asia/Kolkata",
    currency: "INR",
  },
  contact: {
    mapEmbedUrl: null,
    mapLink: null,
    directions: null,
    whatsappMessage: null,
    googleReviewsUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    googleSiteVerification: null,
    youtubeUrl: null,
  },
  numbering: {
    leadPrefix: "SP-L",
    bookingPrefix: "SP-B",
    customerPrefix: "SP-C",
    receiptPrefix: "SP-R",
    invoicePrefix: "SP",
    creditNotePrefix: "SPCN",
  },
  enquiry: {
    duplicateWindowDays: 30,
    responseTimePromise: null,
    defaultAssigneeId: null,
    consentNoticeVersion: "2026-10-draft",
  },
  bookingPolicy: {
    holdDurationHours: 72,
    holdReminderHoursBefore: 12,
    guestCountLockDays: 7,
    advancePercent: null,
    quotationValidityDays: 15,
    defaultCancellationPolicyId: null,
    refundPlateShortfall: false,
  },
  tax: { roundGrandTotal: false, invoiceNotes: null },
  documents: {
    tagline: null,
    footerText: null,
    quotationTerms: null,
    paymentTerms: null,
    bookingConditions: null,
    bankDetails: null,
    maxUploadMb: 4,
  },
};

export const SETTINGS_LABELS: Record<SettingsSectionKey, string> = {
  business: "Business details",
  contact: "Contact page and social links",
  numbering: "Reference numbering",
  enquiry: "Enquiries",
  bookingPolicy: "Booking policy",
  tax: "Totals and invoices",
  documents: "Document wording",
};
