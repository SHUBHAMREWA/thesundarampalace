import { connection, type NextRequest } from "next/server";

import { getApiUser } from "@/server/auth/session";
import { errorResponse } from "@/server/documents/http";
import {
  assertPermission,
  UnauthenticatedError,
} from "@/server/policies/authorize";
import {
  readyMenuPagePreview,
  readyMenuPdfFile,
} from "@/server/services/food-menu";

const notFound = () =>
  new Response("No ready-made menu PDF has been uploaded.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });

/**
 * The ready-made menu PDF uploaded on the Food menu screen (kept privately on
 * Cloudinary), or with `?page=N` a JPEG of one page for the preview. Staff only.
 */
export async function GET(request: NextRequest) {
  await connection();
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    assertPermission(user, "bookings.read");
    const page = request.nextUrl.searchParams.get("page");
    if (page) {
      const image = await readyMenuPagePreview(Number(page));
      if (!image) return notFound();
      return new Response(new Uint8Array(image), {
        headers: {
          "content-type": "image/jpeg",
          "cache-control": "private, max-age=86400",
          "x-content-type-options": "nosniff",
        },
      });
    }
    const file = await readyMenuPdfFile();
    if (!file) return notFound();
    return new Response(file.body, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${file.record.fileName.replace(/[^\w .()-]/g, "")}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
