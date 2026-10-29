import { readFile } from "node:fs/promises";
import path from "node:path";

import { connection, type NextRequest } from "next/server";

import { getApiUser } from "@/server/auth/session";
import { errorResponse } from "@/server/documents/http";
import {
  assertPermission,
  UnauthenticatedError,
} from "@/server/policies/authorize";

const DIR = path.join(process.cwd(), "src", "lib", "pdf", "menu-assets");
/** Pages in the supplied PDF; each has a JPEG preview in menu-assets/original/. */
const ORIGINAL_MENU_PAGES = 10;

/**
 * The ready-made menu PDF the caterer supplied (28 Oct 2026), unchanged, or
 * with `?page=N` a JPEG of one page for the preview. Staff only.
 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    assertPermission(user, "bookings.read");
    const page = Number(request.nextUrl.searchParams.get("page"));
    if (Number.isInteger(page) && page >= 1 && page <= ORIGINAL_MENU_PAGES) {
      const image = await readFile(
        path.join(DIR, "original", `page-${String(page).padStart(2, "0")}.jpg`),
      );
      return new Response(new Uint8Array(image), {
        headers: {
          "content-type": "image/jpeg",
          "cache-control": "private, max-age=86400",
          "x-content-type-options": "nosniff",
        },
      });
    }
    const bytes = await readFile(path.join(DIR, "original-menu.pdf"));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="The Sundaram Palace food menu (original).pdf"`,
        "cache-control": "private, max-age=3600",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
