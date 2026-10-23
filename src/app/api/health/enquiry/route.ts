import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/**
 * Uptime check for the enquiry path: confirms the database answers.
 * Creates no data and returns nothing sensitive.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
