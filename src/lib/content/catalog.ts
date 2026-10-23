/**
 * Fixed vocabularies used by the CMS. Labels for the website come from
 * messages/<locale>.json (`catalog.*`), so Hindi can be added there.
 * These are categories from the requirements — not business facts.
 */

export const FACILITY_KEYS = [
  "ac",
  "power_backup",
  "stage",
  "bridal_room",
  "parking",
  "lift",
  "accessible",
] as const;
export type FacilityKey = (typeof FACILITY_KEYS)[number];

export const HALL_LAYOUTS = ["THEATRE", "BANQUET", "FLOATING", "CLUSTER"] as const;
export type HallLayoutKey = (typeof HALL_LAYOUTS)[number];

export const MENU_CATEGORIES = ["veg", "jain", "non_veg", "custom"] as const;
export const MENU_COURSES = [
  "welcome_drinks",
  "starters",
  "main_course",
  "breads",
  "rice",
  "desserts",
  "live_counters",
  "other",
] as const;

export const MEDIA_GROUPS = [
  "hero",
  "halls",
  "floor_plans",
  "catering",
  "decor",
  "gallery",
  "real_weddings",
  "brochure",
  "other",
] as const;

export const HOME_SECTION_TYPES = [
  "hero",
  "intro",
  "venues",
  "services",
  "catering",
  "decor",
  "packages",
  "gallery",
  "reviews",
  "dates",
  "contact",
] as const;
export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];

/** Public pages that each have a WebsitePage record (title, intro, SEO). */
export const STANDARD_PAGES = [
  { slug: "home", title: "The Sundaram Palace", path: "/" },
  { slug: "about", title: "About us", path: "/about" },
  { slug: "venues", title: "Venues", path: "/venues" },
  { slug: "catering", title: "Catering", path: "/catering" },
  { slug: "decor", title: "Décor themes", path: "/decor" },
  { slug: "services", title: "Celebrations we host", path: "/services" },
  { slug: "packages", title: "Packages", path: "/packages" },
  { slug: "gallery", title: "Gallery", path: "/gallery" },
  { slug: "contact", title: "Contact us", path: "/contact" },
  { slug: "plan-your-event", title: "Plan your event", path: "/plan-your-event" },
] as const;

/** Service pages from the requirements (MASTER_PROMPT §5 "Services"). */
export const DEFAULT_SERVICES = [
  { slug: "weddings", title: "Weddings and celebrations" },
  { slug: "engagements-receptions", title: "Engagements and receptions" },
  { slug: "haldi-mehendi-sangeet", title: "Haldi, mehendi and sangeet" },
  { slug: "catering", title: "Catering" },
  { slug: "decoration", title: "Decoration" },
  { slug: "corporate-social", title: "Corporate and social events" },
] as const;

export const LEGAL_PAGES = [
  { slug: "privacy-policy", title: "Privacy policy" },
  { slug: "terms-and-conditions", title: "Terms and conditions" },
  { slug: "cancellation-refund-policy", title: "Cancellation and refund policy" },
  { slug: "cookie-policy", title: "Cookie policy" },
] as const;

export const DEFAULT_GALLERY_CATEGORIES = [
  { key: "halls", name: "Halls" },
  { key: "decor", name: "Décor" },
  { key: "food", name: "Food" },
  { key: "events", name: "Events" },
] as const;

/** Default homepage section headings (editable in the CMS). */
export const DEFAULT_HOME_SECTIONS: { type: HomeSectionType; heading: string; visible: boolean }[] = [
  { type: "hero", heading: "The Sundaram Palace", visible: true },
  { type: "intro", heading: "Welcome", visible: true },
  { type: "venues", heading: "Our venues", visible: true },
  { type: "services", heading: "Celebrations we host", visible: true },
  { type: "catering", heading: "Catering", visible: true },
  { type: "decor", heading: "Décor themes", visible: true },
  { type: "packages", heading: "Packages", visible: true },
  { type: "gallery", heading: "Gallery", visible: true },
  { type: "reviews", heading: "Reviews", visible: true },
  { type: "dates", heading: "Popular wedding dates", visible: true },
  { type: "contact", heading: "Visit us", visible: true },
];
