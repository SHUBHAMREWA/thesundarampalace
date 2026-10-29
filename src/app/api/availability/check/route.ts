import { NextResponse } from "next/server";
import { clientIp, consumeRateLimit, rateLimitKey } from "@/server/services/rate-limit";
import { checkPublicDateAvailability } from "@/server/services/availability";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? "";

  // Rate limit: 60 checks per minute per IP
  const allowed = await consumeRateLimit(
    rateLimitKey("avail-ip", clientIp(request.headers)),
    60,
    60,
  );
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const result = await checkPublicDateAvailability(date);
    return NextResponse.json(result, {
      headers: {
        "cache-control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Unable to check availability" }, { status: 500 });
  }
}
