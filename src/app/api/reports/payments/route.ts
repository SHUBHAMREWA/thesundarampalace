import { rangeFromParams } from "@/lib/reports/range";
import { getApiUser } from "@/server/auth/session";
import { errorResponse } from "@/server/documents/http";
import { UnauthenticatedError } from "@/server/policies/authorize";
import { paymentsCsv } from "@/server/services/finance";

/** Payments in a date range as CSV: session → `payments.read` → audit log. */
export async function GET(request: Request) {
  try {
    const user = await getApiUser();
    if (!user) throw new UnauthenticatedError();
    const search = new URL(request.url).searchParams;
    const range = rangeFromParams({ from: search.get("from"), to: search.get("to"), preset: search.get("preset") });
    const csv = await paymentsCsv(user, range);
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="payments-${range.from}-to-${range.to}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
