import { getApiUser } from "@/server/auth/session";
import { errorResponse, privateFileHeaders } from "@/server/documents/http";
import { UnauthenticatedError } from "@/server/policies/authorize";
import { readCustomerPhoto } from "@/server/services/customers";

/** A customer's profile photo: session → `customers.personal.read` → stream (never a storage URL). */
export async function GET(_request: Request, { params }: RouteContext<"/api/customers/[id]/photo">) {
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    const { id } = await params;
    const photo = await readCustomerPhoto(user, id);
    return new Response(new Uint8Array(photo.bytes), { headers: privateFileHeaders(photo.mimeType, "photo.webp", "inline") });
  } catch (error) {
    return errorResponse(error);
  }
}
