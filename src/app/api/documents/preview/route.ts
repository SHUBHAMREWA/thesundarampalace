import { connection, type NextRequest } from "next/server";

import { DOCUMENT_PREVIEW_CSP } from "@/lib/security/headers";
import { getApiUser } from "@/server/auth/session";
import { errorResponse } from "@/server/documents/http";
import { warmPdfService } from "@/server/documents/renderer";
import { UnauthenticatedError } from "@/server/policies/authorize";
import { documentRequestFromSearch, previewDocumentHtml } from "@/server/services/documents";

/**
 * Live preview of a document, shown in an iframe in the CRM. Read-only (no
 * record is created). The response has its own strict CSP: no scripts, no
 * network, only embedded fonts and inline styles, framable by the CRM only.
 */
export async function GET(request: NextRequest) {
  await connection(); // per-request: never prerendered at build time
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    const html = await previewDocumentHtml(user, documentRequestFromSearch(request.nextUrl.searchParams));
    warmPdfService();
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        "content-security-policy": DOCUMENT_PREVIEW_CSP,
        "x-frame-options": "SAMEORIGIN",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
