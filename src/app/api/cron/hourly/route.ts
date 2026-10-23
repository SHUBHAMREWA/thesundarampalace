import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { deliverPendingOutbox } from "@/server/services/notifications";
import { releaseExpiredHolds, sendHoldReminders } from "@/server/services/reservations";

/**
 * Called every hour by .github/workflows/scheduler.yml. Hold expiry also
 * happens lazily whenever booking pages are read, so a late or missed run
 * only delays notifications, never correctness.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env().CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const holdsReleased = await releaseExpiredHolds(now);
  const holdRemindersSent = await sendHoldReminders(now);
  const outbox = await deliverPendingOutbox(50, now);
  return NextResponse.json({ ok: true, holdsReleased, holdRemindersSent, outboxProcessed: outbox.processed });
}
