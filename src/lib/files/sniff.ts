/**
 * Upload type detection by content (magic bytes), never by file name or the
 * browser's MIME type (secure-customer-data skill). Allowlist only.
 */
export type AllowedFileType = { mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"; ext: string };

export function sniffFileType(bytes: Uint8Array): AllowedFileType | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (
    b.length >= 8 &&
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return { mime: "application/pdf", ext: "pdf" };
  }
  return null;
}

/** A safe display name: no paths, no control characters, limited length. */
export function safeFileName(name: string, ext: string): string {
  const base = name
    .split(/[\\/]/)
    .pop()!
    .replace(/\.[^.]*$/, "")
    .replace(/[^\p{L}\p{N} _().-]+/gu, "")
    .trim()
    .slice(0, 80);
  return `${base || "document"}.${ext}`;
}
