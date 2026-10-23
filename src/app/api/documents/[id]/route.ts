import { getApiUser, requestMeta } from "@/server/auth/session";
import { errorResponse, privateFileHeaders } from "@/server/documents/http";
import { UnauthenticatedError } from "@/server/policies/authorize";
import { readGeneratedDocument } from "@/server/services/documents";

/** Downloads a generated document. Permission-checked and audit-logged; never cached. */
export async function GET(_request: Request, { params }: RouteContext<"/api/documents/[id]">) {
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    const { id } = await params;
    const file = await readGeneratedDocument(user, id, await requestMeta());
    return new Response(new Uint8Array(file.bytes), { headers: privateFileHeaders(file.mimeType, file.fileName, "attachment") });
  } catch (error) {
    return errorResponse(error);
  }
}
