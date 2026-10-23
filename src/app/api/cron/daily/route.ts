import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { recordAudit } from "@/server/services/audit";
import { runDailyMaintenance } from "@/server/services/maintenance";

/** Called once a day by .github/workflows/scheduler.yml. */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env().CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runDailyMaintenance();
  await recordAudit({ action: "cron.daily", entityType: "system", summary: result });
  return NextResponse.json({ ok: true, ...result });
}
