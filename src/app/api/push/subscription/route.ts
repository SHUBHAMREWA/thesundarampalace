import { connection, NextResponse, type NextRequest } from "next/server";

import { getApiUser } from "@/server/auth/session";
import { errorResponse } from "@/server/documents/http";
import { UnauthenticatedError } from "@/server/policies/authorize";
import { removeSubscription, saveSubscription } from "@/server/services/push";

/**
 * This device's push subscription for the signed-in staff member: POST saves
 * it (also called by the service worker when the browser renews it), DELETE
 * forgets it ({ endpoint }).
 */
export async function POST(request: NextRequest) {
  await connection();
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    await saveSubscription(user, await request.json(), request.headers.get("user-agent"));
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  await connection();
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
    if (endpoint) await removeSubscription(user, endpoint);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
