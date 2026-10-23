/**
 * Default configurable lists from the requirements (MASTER_PROMPT.md §7, §8).
 * English labels only; Hindi labels are added later by a fluent speaker.
 * `systemKey` marks the values that business logic depends on.
 */
export type LookupSeed = { key: string; label: string; systemKey?: string };

export const DEFAULT_LOOKUPS: Record<string, LookupSeed[]> = {
  lead_status: [
    { key: "new", label: "New", systemKey: "NEW" },
    { key: "contacted", label: "Contacted" },
    { key: "follow_up", label: "Follow-up" },
    { key: "site_visit_scheduled", label: "Site Visit Scheduled" },
    { key: "site_visit_done", label: "Site Visit Done" },
    { key: "quotation_sent", label: "Quotation Sent" },
    { key: "negotiation", label: "Negotiation" },
    { key: "won", label: "Won", systemKey: "WON" },
    { key: "lost", label: "Lost", systemKey: "LOST" },
  ],
  lead_source: [
    { key: "website_form", label: "Website form", systemKey: "WEBSITE_FORM" },
    { key: "brochure_download", label: "Brochure download", systemKey: "BROCHURE" },
    { key: "site_visit_form", label: "Site-visit form", systemKey: "SITE_VISIT_FORM" },
    { key: "offer_page", label: "Offer page", systemKey: "OFFER_PAGE" },
    { key: "whatsapp", label: "WhatsApp" },
    { key: "phone_call", label: "Phone call" },
    { key: "walk_in", label: "Walk-in" },
    { key: "instagram", label: "Instagram" },
    { key: "facebook", label: "Facebook" },
    { key: "google_ads", label: "Google Ads" },
    { key: "wedding_portal", label: "Wedding portal" },
    { key: "referral", label: "Referral" },
    { key: "repeat_customer", label: "Repeat customer" },
    { key: "other", label: "Other" },
  ],
  lost_reason: [
    { key: "price", label: "Price" },
    { key: "date_unavailable", label: "Date unavailable" },
    { key: "chose_another_venue", label: "Chose another venue" },
    { key: "postponed", label: "Postponed" },
    { key: "no_response", label: "No response" },
    { key: "other", label: "Other" },
  ],
  event_type: [
    { key: "wedding", label: "Wedding", systemKey: "WEDDING" },
    { key: "engagement", label: "Engagement" },
    { key: "reception", label: "Reception" },
    { key: "sangeet", label: "Sangeet" },
    { key: "haldi_mehendi", label: "Haldi / Mehendi" },
    { key: "birthday", label: "Birthday" },
    { key: "anniversary", label: "Anniversary" },
    { key: "corporate", label: "Corporate event" },
    { key: "other", label: "Other" },
  ],
  customer_category: [
    { key: "high_value", label: "High Value Client" },
    { key: "mid_level", label: "Mid-Level Client" },
    { key: "budget", label: "Budget Client" },
  ],
  profession: [
    { key: "government_employee", label: "Government Employee" },
    { key: "farmer", label: "Farmer" },
    { key: "businessman", label: "Businessman" },
    { key: "doctor", label: "Doctor" },
    { key: "contractor", label: "Contractor" },
    { key: "politician", label: "Politician" },
    { key: "teacher", label: "Teacher" },
    { key: "professor", label: "Professor" },
    { key: "engineer_it", label: "Engineer / IT" },
    { key: "other", label: "Other" },
  ],
};
