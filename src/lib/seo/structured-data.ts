/** BlogPosting (Article) structured data for a published blog post. */
export function articleJsonLd(post: {
  url: string;
  headline: string;
  description?: string | null;
  imageUrl?: string | null;
  author: string;
  publishedAt: string | null;
  updatedAt: string;
  publisherName: string;
  inLanguage: string;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": post.url },
    url: post.url,
    // Google shows at most 110 characters of a headline.
    headline: post.headline.slice(0, 110),
    ...(post.description ? { description: post.description } : {}),
    ...(post.imageUrl ? { image: [post.imageUrl] } : {}),
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: post.publisherName },
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    dateModified: post.updatedAt,
    inLanguage: post.inLanguage,
  };
}

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
