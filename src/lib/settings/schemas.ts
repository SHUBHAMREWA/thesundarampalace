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
  .object({ en: z.string().trim().max(4000), hi: z.string().trim().max(4000).optional() })
  .nullable()
  .transform((v) => (v && (v.en || v.hi) ? { en: v.en, ...(v.hi ? { hi: v.hi } : {}) } : null));

export const businessSettingsSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  legalName: nullableText,
  gstin: nullableText,
  stateCode: nullableText,
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
});

export const numberingSettingsSchema = z.object({
  leadPrefix: z.string().min(1),
  bookingPrefix: z.string().min(1),
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

export const bookingPolicySettingsSchema = z.object({
  /** Tentative hold duration in hours (default 72; confirm with business). */
  holdDurationHours: z.number().int().min(1).max(24 * 30),
  holdReminderHoursBefore: z.number().int().min(0).max(72),
});

export const SETTINGS_SECTIONS = {
  business: businessSettingsSchema,
  contact: contactSettingsSchema,
  numbering: numberingSettingsSchema,
  enquiry: enquirySettingsSchema,
  bookingPolicy: bookingPolicySettingsSchema,
} as const;

export type SettingsSectionKey = keyof typeof SETTINGS_SECTIONS;
export type SettingsSection<K extends SettingsSectionKey> = z.infer<(typeof SETTINGS_SECTIONS)[K]>;

export const DEFAULT_SETTINGS: { [K in SettingsSectionKey]: SettingsSection<K> } = {
  business: {
    displayName: "The Sundaram Palace",
    legalName: null,
    gstin: null,
    stateCode: null,
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
    youtubeUrl: null,
  },
  numbering: { leadPrefix: "SP-L", bookingPrefix: "SP-B" },
  enquiry: {
    duplicateWindowDays: 30,
    responseTimePromise: null,
    defaultAssigneeId: null,
    consentNoticeVersion: "2026-10-draft",
  },
  bookingPolicy: { holdDurationHours: 72, holdReminderHoursBefore: 12 },
};

export const SETTINGS_LABELS: Record<SettingsSectionKey, string> = {
  business: "Business details",
  contact: "Contact page and social links",
  numbering: "Reference numbering",
  enquiry: "Enquiries",
  bookingPolicy: "Booking policy",
};
