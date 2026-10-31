import { connection, type NextRequest } from "next/server";

import { DOCUMENT_PREVIEW_CSP } from "@/lib/security/headers";
import { getApiUser } from "@/server/auth/session";
import { errorResponse } from "@/server/documents/http";
import {
  assertPermission,
  UnauthenticatedError,
} from "@/server/policies/authorize";
import { foodMenuHtml, menuToPrint } from "@/server/services/food-menu";

/** The venue menu (or with ?booking=, that booking's picked items) as printable pages, shown in an iframe in the CRM (same HTML as the PDF). */
export async function GET(request: NextRequest) {
  await connection(); // per-request: never prerendered at build time
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    assertPermission(user, "bookings.read");
    const { menu } = await menuToPrint(
      user,
      request.nextUrl.searchParams.get("booking"),
    );
    return new Response(foodMenuHtml(menu), {
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
