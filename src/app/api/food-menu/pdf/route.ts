import { connection, type NextRequest } from "next/server";

import { DOCUMENT_PREVIEW_CSP } from "@/lib/security/headers";
import { getApiUser } from "@/server/auth/session";
import { errorResponse } from "@/server/documents/http";
import {
  assertPermission,
  UnauthenticatedError,
} from "@/server/policies/authorize";
import {
  foodMenuHtml,
  foodMenuPdf,
  menuToPrint,
} from "@/server/services/food-menu";

/**
 * Downloads the food menu as a PDF. Without a PDF renderer (PDF_RENDERER=none)
 * the printable page is returned instead, to save with the browser's Print.
 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    assertPermission(user, "bookings.read");
    const { menu, fileName } = await menuToPrint(
      user,
      request.nextUrl.searchParams.get("booking"),
    );
    const pdf = await foodMenuPdf(menu);
    if (!pdf) {
      return new Response(foodMenuHtml(menu), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "private, no-store",
          "content-security-policy": DOCUMENT_PREVIEW_CSP,
        },
      });
    }
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
