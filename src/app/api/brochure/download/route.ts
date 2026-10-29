import { NextResponse } from "next/server";
import { clientIp, consumeRateLimit, rateLimitKey } from "@/server/services/rate-limit";
import { brochureLeadSchema, generateBrochurePdf, recordBrochureDownloadLead } from "@/server/services/brochure";

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  const allowed = await consumeRateLimit(rateLimitKey("brochure-ip", ip), 15, 600);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const json = await request.json().catch(() => ({}));
    if (json.fullName && json.phone) {
      const parsed = brochureLeadSchema.safeParse(json);
      if (parsed.success) {
        await recordBrochureDownloadLead(parsed.data);
      }
    }

    const locale = json.locale === "hi" ? "hi" : "en";
    const pdfBuffer = await generateBrochurePdf(locale);

    if (!pdfBuffer) {
      return NextResponse.json({ error: "Brochure PDF rendering unavailable" }, { status: 503 });
    }

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": 'attachment; filename="The-Sundaram-Palace-Brochure.pdf"',
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to download brochure" }, { status: 500 });
  }
}
