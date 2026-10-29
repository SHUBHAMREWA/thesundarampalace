import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { clientIp, consumeRateLimit, rateLimitKey } from "@/server/services/rate-limit";

const eventSchema = z.object({
  type: z.enum(["whatsapp_click", "call_click", "directions_click", "brochure_download"]),
  page: z.string().max(300).optional(),
  locale: z.enum(["en", "hi"]).optional(),
});

/**
 * Conversion counter for reports (docs/architecture.md ADR-18). Stores the
 * event type and page only — no names, phones, cookies or IP addresses.
 */
export async function POST(request: NextRequest) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const allowed = await consumeRateLimit(rateLimitKey("events-ip", clientIp(request.headers)), 60, 60);
  if (!allowed) return NextResponse.json({ ok: false }, { status: 429 });
  await db.conversionEvent.create({
    data: { type: parsed.data.type, page: parsed.data.page ?? null, locale: parsed.data.locale ?? null },
  });
  return NextResponse.json({ ok: true });
}
