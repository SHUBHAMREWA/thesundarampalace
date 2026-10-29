/** Plain text from the CMS rich-text format (## headings, lists, **bold**, [links](…)). */
export function plainText(source: string): string {
  return source
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The opening words of an article, cut at a word, for search descriptions (Google shows ~155 characters). */
export function excerpt(source: string, max = 155): string {
  const text = plainText(source);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Minutes to read, at about 200 words a minute. */
export function readingMinutes(source: string): number {
  return Math.max(1, Math.round(plainText(source).split(" ").filter(Boolean).length / 200));
}
