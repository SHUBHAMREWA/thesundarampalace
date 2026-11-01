import { getApiUser, requestMeta } from "@/server/auth/session";
import { errorResponse, privateFileHeaders } from "@/server/documents/http";
import { UnauthenticatedError } from "@/server/policies/authorize";
import { brideGroomPack } from "@/server/services/bride-groom-pack";

/**
 * Downloads one ZIP with the booking's bride and groom details and their ID
 * documents and photos. Permission-checked and audit-logged; never cached.
 */
export async function GET(_request: Request, { params }: RouteContext<"/api/bookings/[id]/bride-groom">) {
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    const { id } = await params;
    const pack = await brideGroomPack(user, id, await requestMeta());
    return new Response(new Uint8Array(pack.bytes), {
      headers: privateFileHeaders("application/zip", pack.fileName, "attachment"),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
