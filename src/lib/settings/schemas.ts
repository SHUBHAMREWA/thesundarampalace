import { z } from "zod";

/**
 * Typed settings sections stored in `site_setting`. Business facts default to
 * null and are filled in by the business (docs/missing-business-info.md);
 * policy numbers marked "default" are editable placeholders, not facts.
 */

export const businessSettingsSchema = z.object({
  displayName: z.string().min(1),
  legalName: z.string().nullable(),
  gstin: z.string().nullable(),
  stateCode: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.email().nullable(),
  officeHours: z.string().nullable(),
  timeZone: z.literal("Asia/Kolkata"),
  currency: z.literal("INR"),
});

export const numberingSettingsSchema = z.object({
  leadPrefix: z.string().min(1),
  bookingPrefix: z.string().min(1),
});

export const enquirySettingsSchema = z.object({
  /** Same phone within this many days updates the open lead (default; confirm). */
  duplicateWindowDays: z.number().int().min(0).max(365),
  /** Shown on the enquiry success screen; null until the business supplies it. */
  responseTimePromise: z.string().nullable(),
});

export const bookingPolicySettingsSchema = z.object({
  /** Tentative hold duration in hours (default 72; confirm with business). */
  holdDurationHours: z.number().int().min(1).max(24 * 30),
  holdReminderHoursBefore: z.number().int().min(0).max(72),
});

export const SETTINGS_SECTIONS = {
  business: businessSettingsSchema,
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
  numbering: { leadPrefix: "SP-L", bookingPrefix: "SP-B" },
  enquiry: { duplicateWindowDays: 30, responseTimePromise: null },
  bookingPolicy: { holdDurationHours: 72, holdReminderHoursBefore: 12 },
};

export const SETTINGS_LABELS: Record<SettingsSectionKey, string> = {
  business: "Business details",
  numbering: "Reference numbering",
  enquiry: "Enquiries",
  bookingPolicy: "Booking policy",
};
