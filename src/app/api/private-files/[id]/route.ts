import { getApiUser, requestMeta } from "@/server/auth/session";
import { errorResponse, privateFileHeaders } from "@/server/documents/http";
import { UnauthenticatedError } from "@/server/policies/authorize";
import { readCustomerDocument } from "@/server/services/customers";

/**
 * Identity documents and customer photos. There is no other way to reach
 * these bytes: session → `documents.sensitive.read` → audit log → stream.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/private-files/[id]">,
) {
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    // ?thumb=1: small preview shown on the booking page (also audit-logged).
    const thumbnail = query.get("thumb") === "1";
    const file = await readCustomerDocument(user, id, await requestMeta(), {
      thumbnail,
    });
    const inline =
      (query.get("view") === "1" || thumbnail) &&
      file.mimeType.startsWith("image/");
    return new Response(new Uint8Array(file.bytes), {
      headers: privateFileHeaders(
        file.mimeType,
        file.fileName,
        inline ? "inline" : "attachment",
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
