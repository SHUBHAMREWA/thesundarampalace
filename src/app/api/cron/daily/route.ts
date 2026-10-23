import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";
import { isAuthorizedCronRequest } from "@/lib/security/cron-auth";
import { recordAudit } from "@/server/services/audit";
import { pruneTemporaryDocuments } from "@/server/services/documents";
import { runDailyMaintenance } from "@/server/services/maintenance";
import { sendPaymentDueReminders } from "@/server/services/money";
import { deliverPendingOutbox } from "@/server/services/notifications";

/** Called once a day by .github/workflows/scheduler.yml. */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env().CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runDailyMaintenance();
  const paymentRemindersSent = await sendPaymentDueReminders();
  const temporaryDocumentsPruned = await pruneTemporaryDocuments();
  // Retry any notification emails that failed earlier.
  const outbox = await deliverPendingOutbox(100);
  Object.assign(result, { paymentRemindersSent, temporaryDocumentsPruned, outboxProcessed: outbox.processed });
  await recordAudit({ action: "cron.daily", entityType: "system", summary: result });
  return NextResponse.json({ ok: true, ...result });
}
