import { FileText, Wallet } from "lucide-react";
import { SectionTitle } from "@/components/crm/person-avatar";
import Link from "next/link";

import { ActionPanel, ConfirmAction } from "@/components/crm/action-kit";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/forms/form-kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isFirm, type BookingStatus } from "@/lib/booking/rules";
import { formatINR, money } from "@/lib/money";
import { dateKey, formatDateKey, todayIST } from "@/lib/time";
import {
  issueCreditNoteAction,
  issueInvoiceAction,
  recordAdjustmentAction,
  recordPaymentAction,
  recordRefundAction,
} from "@/server/actions/money";
import { DOCUMENT_TYPES } from "@/lib/pdf/fields";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import type { getBookingDetail } from "@/server/services/bookings";
import {
  creditableLines,
  moneySummary,
  PAYMENT_METHODS,
} from "@/server/services/money";

import { PaymentHistoryActions } from "./payment-history-actions";

type Booking = Awaited<ReturnType<typeof getBookingDetail>>;

const methods = PAYMENT_METHODS.map((m) => ({
  value: m.value,
  label: m.label,
}));
const methodLabel = (m: string | null) =>
  PAYMENT_METHODS.find((x) => x.value === m)?.label ?? "—";
const STATUS_TEXT = {
  NOTHING_DUE: "Nothing due",
  NOT_PAID: "Not paid",
  PARTLY_PAID: "Partly paid",
  PAID: "Paid",
  OVERPAID: "Overpaid",
} as const;
const STATUS_VARIANT = {
  NOTHING_DUE: "secondary",
  NOT_PAID: "danger",
  PARTLY_PAID: "warning",
  PAID: "success",
  OVERPAID: "info",
} as const;

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint ? <p className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export async function MoneyTab({
  booking,
  user,
}: {
  booking: Booking;
  user: CurrentUser;
}) {
  const summary = await moneySummary(user, booking.id);
  const { balance } = summary;
  const today = todayIST();
  const cancelled = booking.status === "CANCELLED";
  const firm = isFirm(booking.status as BookingStatus);
  const creditable = await Promise.all(
    summary.invoices.map((i) => creditableLines(i.id)),
  );
  const quotationInvoiced = summary.invoices.some(
    (i) =>
      i.quotationVersionId && i.quotationVersionId === summary.accepted?.id,
  );
  const mismatch =
    summary.invoices.length > 0 &&
    !cancelled &&
    !summary.netInvoiced.equals(balance.billable);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Booking amount"
          value={formatINR(
            summary.accepted?.grandTotal ?? booking.bookingAmount ?? "0",
          )}
          hint={
            summary.accepted
              ? `From accepted quotation v${summary.accepted.versionNumber}`
              : booking.bookingAmount
                ? "Entered when the booking was made"
                : "Not entered yet — Overview → Edit details"
          }
        />
        <Tile
          label="Received (net)"
          value={formatINR(balance.netReceived)}
          hint={`${formatINR(balance.payments)} paid · ${formatINR(balance.refunds)} refunded`}
        />
        <Tile
          label={cancelled ? "Refund still due" : "Balance due"}
          value={formatINR(
            cancelled ? balance.refundStillDue : balance.outstanding,
          )}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={STATUS_VARIANT[balance.status]}>
          {STATUS_TEXT[balance.status]}
        </Badge>
        {summary.invoices.length ? (
          <span className="text-text-muted">
            Invoiced {formatINR(summary.invoicedTotal)}, credited{" "}
            {formatINR(summary.creditedTotal)}.
          </span>
        ) : null}
        {mismatch ? (
          <span className="text-warning">
            Invoices (net {formatINR(summary.netInvoiced)}) differ from the
            agreed total ({formatINR(balance.billable)}) — issue a
            credit note or an invoice for the difference.
          </span>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>
            <SectionTitle icon={Wallet} tone="green">
              Payments and refunds
            </SectionTitle>
          </CardTitle>
          {summary.ledger.length && can(user, "pdf.financial") ? (
            <PaymentHistoryActions
              bookingId={booking.id}
              fields={DOCUMENT_TYPES.payment_statement.defaults}
            />
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {summary.ledger.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entry</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.ledger.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateKey(dateKey(e.occurredOn))}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">
                          {e.type === "PAYMENT"
                            ? `Payment ${e.receiptNumber ?? ""}`
                            : e.type === "REFUND"
                              ? "Refund"
                              : "Adjustment"}
                          {e.reversed ? (
                            <Badge variant="outline" className="ml-2">
                              reversed
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-text-muted">
                          {[
                            e.reason,
                            e.notes,
                            e.transactionRef ? `ref ${e.transactionRef}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </TableCell>
                      <TableCell>{methodLabel(e.method)}</TableCell>
                      <TableCell
                        className={`text-right whitespace-nowrap ${e.direction === "OUT" ? "text-danger" : ""}`}
                      >
                        {e.direction === "OUT" ? "− " : ""}
                        {formatINR(e.amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {e.receiptNumber && can(user, "pdf.financial") ? (
                          <Link
                            href={`/admin/bookings/${booking.id}?tab=documents&type=payment_receipt&source=${e.id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            Receipt
                          </Link>
                        ) : null}
                        {can(user, "refunds.create") &&
                        !e.reversed &&
                        !e.reversesEntryId ? (
                          <ConfirmAction
                            action={recordAdjustmentAction.bind(
                              null,
                              booking.id,
                            )}
                            label="Reverse"
                            title="Reverse this entry?"
                            description={`Records an equal and opposite adjustment of ${formatINR(e.amount)}. The original entry stays in the ledger.`}
                            reasonName="reason"
                            reasonRequired
                            triggerVariant="ghost"
                            money
                          >
                            <input
                              type="hidden"
                              name="reversesEntryId"
                              value={e.id}
                            />
                            <input
                              type="hidden"
                              name="amount"
                              value={e.amount.toFixed(2)}
                            />
                            <input
                              type="hidden"
                              name="direction"
                              value={e.direction === "IN" ? "OUT" : "IN"}
                            />
                            <TextField
                              name="occurredOn"
                              label="Date"
                              type="date"
                              defaultValue={today}
                            />
                          </ConfirmAction>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-text-muted">Nothing recorded yet.</p>
          )}
          <div className="space-y-4">
            {can(user, "payments.create") && !cancelled ? (
              <div className="max-w-xl">
                <h3 className="mb-3 text-sm font-semibold">Record a payment</h3>
                <ActionPanel
                  action={recordPaymentAction.bind(null, booking.id)}
                  submitLabel="Record payment"
                  label="Record a payment"
                  money
                  resetAfter
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      name="amount"
                      label="Amount (₹)"
                      inputMode="decimal"
                    />
                    <TextField
                      name="occurredOn"
                      label="Received on"
                      type="date"
                      defaultValue={today}
                      max={today}
                    />
                  </div>
                  {/* Only amount and date are asked; the method is recorded as cash. */}
                  <input type="hidden" name="method" value="CASH" />
                </ActionPanel>
              </div>
            ) : null}
            {can(user, "refunds.create") ? (
              <details className="max-w-xl rounded-lg border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  Record a refund
                </summary>
                <div className="mt-3">
                  <ActionPanel
                    action={recordRefundAction.bind(null, booking.id)}
                    submitLabel="Record refund"
                    label="Record a refund"
                    money
                    resetAfter
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField
                        name="amount"
                        label="Amount (₹)"
                        inputMode="decimal"
                        defaultValue={
                          cancelled && balance.refundStillDue.greaterThan(0)
                            ? balance.refundStillDue.toFixed(2)
                            : undefined
                        }
                      />
                      <TextField
                        name="occurredOn"
                        label="Paid on"
                        type="date"
                        defaultValue={today}
                        max={today}
                      />
                      <SelectField
                        name="method"
                        label="Method"
                        options={methods}
                        placeholder="Choose…"
                      />
                      <TextField name="transactionRef" label="Reference" />
                    </div>
                    <TextField
                      name="reason"
                      label="Reason"
                      defaultValue={
                        cancelled ? "Cancellation refund" : undefined
                      }
                    />
                  </ActionPanel>
                </div>
              </details>
            ) : null}
          </div>
          {can(user, "refunds.create") ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-primary">
                Other adjustment (with a reason)
              </summary>
              <div className="mt-3 max-w-xl">
                <ActionPanel
                  action={recordAdjustmentAction.bind(null, booking.id)}
                  submitLabel="Record adjustment"
                  label="Other adjustment"
                  money
                  resetAfter
                >
                  <div className="grid gap-3 sm:grid-cols-3">
                    <TextField
                      name="amount"
                      label="Amount (₹)"
                      inputMode="decimal"
                    />
                    <SelectField
                      name="direction"
                      label="Effect"
                      options={[
                        { value: "IN", label: "Counts as received" },
                        { value: "OUT", label: "Reduces received" },
                      ]}
                    />
                    <TextField
                      name="occurredOn"
                      label="Date"
                      type="date"
                      defaultValue={today}
                      max={today}
                    />
                  </div>
                  <TextField name="reason" label="Reason" />
                </ActionPanel>
              </div>
            </details>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <SectionTitle icon={FileText} tone="rose">
              Invoices and credit notes
            </SectionTitle>
          </CardTitle>
          <p className="text-sm text-text-muted">
            Issued invoices never change. Reductions and cancellations are
            credit notes.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {summary.invoices.map((inv, index) => {
            const lines = creditable[index].lines;
            const remaining = lines.reduce(
              (acc, l) => acc.plus(l.remaining.lineTotal),
              money(0),
            );
            return (
              <div key={inv.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {inv.number}{" "}
                    <span className="font-normal text-text-muted">
                      · {formatDateKey(dateKey(inv.issuedOn))} ·{" "}
                      {inv.quotationVersionId
                        ? "booking"
                        : "post-event charges"}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={inv.status === "ISSUED" ? "success" : "warning"}
                    >
                      {inv.status.replace("_", " ").toLowerCase()}
                    </Badge>
                    <span className="font-semibold">
                      {formatINR(inv.grandTotal)}
                    </span>
                    {can(user, "pdf.financial") ? (
                      <Link
                        href={`/admin/bookings/${booking.id}?tab=documents&type=tax_invoice&source=${inv.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        PDF
                      </Link>
                    ) : null}
                  </div>
                </div>
                {inv.creditNotes.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {inv.creditNotes.map((cn) => (
                      <li
                        key={cn.id}
                        className="flex flex-wrap justify-between gap-2"
                      >
                        <span>
                          Credit note {cn.number} ·{" "}
                          {formatDateKey(dateKey(cn.issuedOn))} — {cn.reason}
                        </span>
                        <span>
                          − {formatINR(cn.grandTotal)}{" "}
                          {can(user, "pdf.financial") ? (
                            <Link
                              href={`/admin/bookings/${booking.id}?tab=documents&type=credit_note&source=${cn.id}`}
                              className="ml-2 text-primary hover:underline"
                            >
                              PDF
                            </Link>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {can(user, "credit_notes.issue") && remaining.greaterThan(0) ? (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium text-primary">
                      Issue a credit note (up to {formatINR(remaining)})
                    </summary>
                    <div className="mt-3">
                      <ActionPanel
                        action={issueCreditNoteAction.bind(
                          null,
                          booking.id,
                          inv.id,
                        )}
                        submitLabel="Issue credit note"
                        money
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TextField
                            name="issuedOn"
                            label="Date"
                            type="date"
                            defaultValue={today}
                            max={today}
                          />
                          <SelectField
                            name="mode"
                            label="Credit"
                            options={[
                              {
                                value: "lines",
                                label: "Amounts per line (below)",
                              },
                              {
                                value: "all",
                                label: "Everything still creditable",
                              },
                            ]}
                          />
                        </div>
                        <TextField
                          name="reason"
                          label="Reason"
                          defaultValue={
                            cancelled ? "Booking cancelled" : undefined
                          }
                        />
                        <div className="space-y-2">
                          {lines
                            .filter((l) =>
                              l.remaining.taxableValue.greaterThan(0),
                            )
                            .map(({ line, remaining: r }) => (
                              <TextField
                                key={line.id}
                                name={`lines.${line.id}`}
                                label={`${line.description} — taxable value to credit (max ${formatINR(r.taxableValue)})`}
                                inputMode="decimal"
                              />
                            ))}
                        </div>
                      </ActionPanel>
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })}
          {can(user, "invoices.issue") && firm ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {summary.accepted && !quotationInvoiced ? (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">
                    Invoice the accepted quotation (v
                    {summary.accepted.versionNumber},{" "}
                    {formatINR(summary.accepted.grandTotal)})
                  </h3>
                  <ActionPanel
                    action={issueInvoiceAction.bind(null, booking.id)}
                    submitLabel="Issue invoice"
                    label="Invoice the accepted quotation"
                    money
                  >
                    <input type="hidden" name="source" value="QUOTATION" />
                    <TextField
                      name="issuedOn"
                      label="Invoice date"
                      type="date"
                      defaultValue={today}
                      max={today}
                    />
                    <TextAreaField
                      name="notes"
                      label="Notes (optional; defaults from Settings)"
                      rows={2}
                    />
                  </ActionPanel>
                </div>
              ) : null}
            </div>
          ) : null}
          {!summary.invoices.length &&
          !(can(user, "invoices.issue") && firm) ? (
            <p className="text-sm text-text-muted">
              No invoices yet. They are issued after confirmation.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
