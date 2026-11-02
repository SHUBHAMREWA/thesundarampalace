import { getApiUser, requestMeta } from "@/server/auth/session";
import { errorResponse } from "@/server/documents/http";
import { UnauthenticatedError } from "@/server/policies/authorize";
import { brideGroomSheet } from "@/server/services/bride-groom-pack";

/**
 * The booking's bride and groom sheet (bride left, groom right, with their
 * documents), as an A4 page the CRM prints / saves as PDF from a hidden frame.
 * Permission-checked and audit-logged; never cached. Framing and the
 * no-script CSP come from next.config.ts (documentPreviewHeaders).
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/bookings/[id]/bride-groom">) {
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    const { id } = await params;
    const html = await brideGroomSheet(user, id, await requestMeta());
    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
