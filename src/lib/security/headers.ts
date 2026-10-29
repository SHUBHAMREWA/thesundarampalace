/**
 * Security headers.
 *
 * Public website pages are statically generated (free-tier strategy), so they
 * can't carry a per-request nonce. They get a CSP without nonces that still
 * blocks plugins, framing, foreign forms and foreign scripts.
 * The CRM (`/admin`) is always dynamic and gets a strict nonce-based CSP from
 * `src/proxy.ts`, which overrides the static one.
 */

const isDev = process.env.NODE_ENV === "development";

const CLOUDINARY = "https://res.cloudinary.com";
const GOOGLE_MAPS = "https://www.google.com https://maps.google.com";

function compact(policy: string): string {
  return policy.replace(/\s{2,}/g, " ").trim();
}

export function publicCsp(): string {
  return compact(`
    default-src 'self';
    script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: ${CLOUDINARY};
    media-src 'self' ${CLOUDINARY};
    font-src 'self';
    connect-src 'self'${isDev ? " ws:" : ""};
    frame-src ${GOOGLE_MAPS};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${isDev ? "" : "upgrade-insecure-requests;"}
  `);
}

export function adminCsp(nonce: string): string {
  return compact(`
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: ${CLOUDINARY};
    media-src 'self' ${CLOUDINARY};
    font-src 'self';
    connect-src 'self' https://api.cloudinary.com${isDev ? " ws:" : ""};
    worker-src 'self';
    manifest-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${isDev ? "" : "upgrade-insecure-requests;"}
  `);
}

/**
 * Document previews (src/app/api/documents/preview): no scripts, no network,
 * embedded fonts only, and framable by the CRM on the same origin.
 */
export const DOCUMENT_PREVIEW_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

export function documentPreviewHeaders(): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: DOCUMENT_PREVIEW_CSP },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
  ];
}

export function staticSecurityHeaders(): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: publicCsp() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
    ...(isDev
      ? []
      : [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ]),
  ];
}
