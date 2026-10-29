/**
 * Google Maps links for the venue. The "Embed a map" URL from Settings wins;
 * otherwise the map is built from the saved name and address (no API key needed).
 */

type MapContact = {
  displayName: string;
  address: string | null;
  city: string | null;
  contact: { mapEmbedUrl: string | null; mapLink: string | null };
};

/** Only Google Maps embed URLs are rendered in an iframe. */
export function isMapEmbed(url: string): boolean {
  return /^https:\/\/(www\.)?google\.com\/maps\/embed\?/.test(url);
}

function query(c: MapContact): string | null {
  if (!c.address) return null;
  return [c.displayName, c.address, c.city].filter(Boolean).join(", ");
}

export function mapEmbedUrl(c: MapContact): string | null {
  if (c.contact.mapEmbedUrl && isMapEmbed(c.contact.mapEmbedUrl)) return c.contact.mapEmbedUrl;
  const q = query(c);
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : null;
}

export function directionsUrl(c: MapContact): string | null {
  if (c.contact.mapLink) return c.contact.mapLink;
  const q = query(c);
  return q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : null;
}
