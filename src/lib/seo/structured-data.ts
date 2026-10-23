/**
 * EventVenue structured data using ONLY details the business has entered
 * (luxury-venue-content skill): no ratings, reviews or invented fields.
 */
export type VenueFacts = {
  name: string;
  url: string;
  telephone?: string | null;
  email?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  imageUrl?: string | null;
  sameAs?: (string | null)[];
};

export function eventVenueJsonLd(facts: VenueFacts): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "EventVenue",
    name: facts.name,
    url: facts.url,
  };
  if (facts.telephone) data.telephone = facts.telephone;
  if (facts.email) data.email = facts.email;
  if (facts.streetAddress || facts.city) {
    data.address = {
      "@type": "PostalAddress",
      ...(facts.streetAddress ? { streetAddress: facts.streetAddress } : {}),
      ...(facts.city ? { addressLocality: facts.city } : {}),
      addressCountry: "IN",
    };
  }
  if (facts.imageUrl) data.image = facts.imageUrl;
  const sameAs = (facts.sameAs ?? []).filter((v): v is string => !!v);
  if (sameAs.length) data.sameAs = sameAs;
  return data;
}
