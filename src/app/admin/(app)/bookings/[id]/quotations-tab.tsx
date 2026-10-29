import { ArrowDown, ArrowUp, FileText } from "lucide-react";

import { ActionPanel, InlineAction } from "@/components/crm/action-kit";
import {
  CheckboxField,
  TextAreaField,
  TextField,
} from "@/components/forms/form-kit";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { whatsappLink } from "@/lib/contact/links";
import { formatINR, money } from "@/lib/money";
import { DOCUMENT_TYPES } from "@/lib/pdf/fields";
import { dateKey, formatDateKey } from "@/lib/time";
import { gstStateLabel } from "@/lib/validation/gst";
import {
  addLineAction,
  createDraftAction,
  moveLineAction,
  removeLineAction,
  updateDraftOptionsAction,
  updateLineAction,
} from "@/server/actions/quotations";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import type { getBookingDetail } from "@/server/services/bookings";
import { listQuotations } from "@/server/services/quotations";

import { LineForm } from "./line-form";
import { QuotationShare } from "./quotation-share";

type Booking = Awaited<ReturnType<typeof getBookingDetail>>;

export async function QuotationsTab({
  booking,
  user,
}: {
  booking: Booking;
  user: CurrentUser;
}) {
  const versions = await listQuotations(user, booking.id);
  const closed =
    booking.status === "CANCELLED" || booking.status === "COMPLETED";
  const canCreate = can(user, "quotations.create") && !closed;
  if (!versions.length) {
    return (
      <EmptyState
        icon={FileText}
        title="No quotation yet"
        description="Start one and type each item with this customer's price. You can change it any time."
        action={
          canCreate ? (
            <InlineAction action={createDraftAction.bind(null, booking.id)}>
              Start a quotation
            </InlineAction>
          ) : undefined
        }
      />
    );
  }
  // One quotation per booking, edited in place (owner, 29 Oct 2026). Older
  // bookings may still hold several versions: the newest one is shown.
  const selected = versions[0];
  const isDraft = canCreate;
  const functionOptions = booking.subEvents.map((s) => ({
    value: s.id,
    label: `${s.name} · ${formatDateKey(dateKey(s.date), "d MMM")}`,
  }));
  const intra = selected.supplyType === "INTRA";
  // Only versions made before GST was removed (26 Oct 2026) carry tax.
  const hasGst = !money(selected.taxTotal).isZero();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Quotation</CardTitle>
            <p className="text-sm text-text-muted">
              {hasGst
                ? `${selected.pricesIncludeTax ? "Prices include GST" : "GST added on top"} · ${intra ? "intra-state (CGST + SGST)" : "inter-state (IGST)"} · place of supply ${gstStateLabel(selected.placeOfSupplyStateCode)} · `
                : ""}
              {selected.validUntil
                ? `Valid until ${formatDateKey(dateKey(selected.validUntil))}`
                : ""}
            </p>
          </div>
          {can(user, "pdf.quotation") ? (
            <QuotationShare
              bookingId={booking.id}
              versionId={selected.id}
              fields={DOCUMENT_TYPES.quotation.defaults}
              fileName={`Quotation ${booking.reference}.pdf`}
              whatsappHref={
                booking.customer
                  ? whatsappLink(
                      booking.customer.mobile,
                      `Namaste ${booking.customer.fullName}, here is your quotation for ${booking.mainEventName} from The Sundaram Palace.`,
                    )
                  : null
              }
            />
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {selected.lines.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      Discount
                    </TableHead>
                    {hasGst ? (
                      <TableHead className="hidden text-right lg:table-cell">
                        Taxable
                      </TableHead>
                    ) : null}
                    {hasGst ? (
                      <TableHead className="hidden text-right lg:table-cell">
                        GST
                      </TableHead>
                    ) : null}
                    <TableHead className="text-right">Total</TableHead>
                    {isDraft ? (
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.lines.map((l, i) => {
                    const discount = money(l.discount).plus(
                      money(l.allocatedDiscount),
                    );
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <p className="font-medium">{l.description}</p>
                          <p className="text-xs text-text-muted">
                            {[
                              l.subEventLabel,
                              l.sacCode ? `SAC ${l.sacCode}` : null,
                              l.kind.toLowerCase().replace("_", " "),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {isDraft ? (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-primary">
                                Edit line
                              </summary>
                              <div className="mt-2">
                                <LineForm
                                  action={updateLineAction.bind(
                                    null,
                                    booking.id,
                                    l.id,
                                  )}
                                  functions={functionOptions}
                                  submitLabel="Save line"
                                  defaults={{
                                    kind: l.kind,
                                    subEventId: l.subEventId ?? "",
                                    description: l.description,
                                    unit: l.unit,
                                    quantity: l.quantity.toString(),
                                    unitPrice: l.unitPrice.toFixed(2),
                                    discount: l.discount.toFixed(2),
                                  }}
                                />
                              </div>
                            </details>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {l.quantity.toString()} {l.unit}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {formatINR(l.unitPrice)}
                        </TableCell>
                        <TableCell className="hidden text-right whitespace-nowrap md:table-cell">
                          {discount.isZero() ? "—" : formatINR(discount)}
                        </TableCell>
                        {hasGst ? (
                          <TableCell className="hidden text-right whitespace-nowrap lg:table-cell">
                            {formatINR(l.taxableValue)}
                          </TableCell>
                        ) : null}
                        {hasGst ? (
                          <TableCell className="hidden text-right whitespace-nowrap lg:table-cell">
                            {l.taxRatePercent.toString()}% ·{" "}
                            {formatINR(money(l.cgst).plus(l.sgst).plus(l.igst))}
                          </TableCell>
                        ) : null}
                        <TableCell className="text-right font-medium whitespace-nowrap">
                          {formatINR(l.lineTotal)}
                        </TableCell>
                        {isDraft ? (
                          <TableCell className="whitespace-nowrap">
                            {i > 0 ? (
                              <InlineAction
                                action={moveLineAction.bind(
                                  null,
                                  booking.id,
                                  l.id,
                                  "up",
                                )}
                                variant="ghost"
                                size="sm"
                                aria-label="Move up"
                              >
                                <ArrowUp aria-hidden="true" />
                              </InlineAction>
                            ) : null}
                            {i < selected.lines.length - 1 ? (
                              <InlineAction
                                action={moveLineAction.bind(
                                  null,
                                  booking.id,
                                  l.id,
                                  "down",
                                )}
                                variant="ghost"
                                size="sm"
                                aria-label="Move down"
                              >
                                <ArrowDown aria-hidden="true" />
                              </InlineAction>
                            ) : null}
                            <InlineAction
                              action={removeLineAction.bind(
                                null,
                                booking.id,
                                l.id,
                              )}
                              variant="ghost"
                              size="sm"
                              className="text-danger"
                            >
                              Remove
                            </InlineAction>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No lines yet.</p>
          )}

          <dl className="ml-auto grid max-w-sm grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <dt className="text-text-muted">Subtotal</dt>
            <dd className="text-right">{formatINR(selected.subtotal)}</dd>
            {!money(selected.discountTotal).isZero() ? (
              <>
                <dt className="text-text-muted">Discounts</dt>
                <dd className="text-right">
                  − {formatINR(selected.discountTotal)}
                </dd>
              </>
            ) : null}
            {hasGst ? (
              <>
                <dt className="text-text-muted">Taxable value</dt>
                <dd className="text-right">
                  {formatINR(selected.taxableTotal)}
                </dd>
              </>
            ) : null}
            {!hasGst ? null : intra ? (
              <>
                <dt className="text-text-muted">CGST</dt>
                <dd className="text-right">{formatINR(selected.cgstTotal)}</dd>
                <dt className="text-text-muted">SGST</dt>
                <dd className="text-right">{formatINR(selected.sgstTotal)}</dd>
              </>
            ) : (
              <>
                <dt className="text-text-muted">IGST</dt>
                <dd className="text-right">{formatINR(selected.igstTotal)}</dd>
              </>
            )}
            {!money(selected.roundOff).isZero() ? (
              <>
                <dt className="text-text-muted">Round-off</dt>
                <dd className="text-right">{formatINR(selected.roundOff)}</dd>
              </>
            ) : null}
            <dt className="border-t border-border pt-1 font-semibold">Total</dt>
            <dd className="border-t border-border pt-1 text-right font-semibold">
              {formatINR(selected.grandTotal)}
            </dd>
          </dl>

          {isDraft ? (
            <>
              <div className="rounded-lg border border-dashed border-border p-4">
                <h3 className="text-sm font-semibold">Add a line</h3>
                <p className="mb-3 text-xs text-text-muted">
                  Type each item with this customer&apos;s own price. Add as
                  many lines as you need.
                </p>
                <LineForm
                  action={addLineAction.bind(null, booking.id, selected.id)}
                  functions={functionOptions}
                  submitLabel="Add line"
                  reset
                />
              </div>
              <details className="rounded-lg border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  Quotation options (discount, validity, terms)
                </summary>
                <div className="mt-4">
                  <ActionPanel
                    action={updateDraftOptionsAction.bind(
                      null,
                      booking.id,
                      selected.id,
                    )}
                    submitLabel="Save options"
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <TextField
                        name="bookingDiscount"
                        label="Overall discount (₹, spread over the lines)"
                        inputMode="decimal"
                        defaultValue={selected.bookingDiscount.toFixed(2)}
                      />
                      <TextField
                        name="validUntil"
                        label="Valid until"
                        type="date"
                        defaultValue={
                          selected.validUntil
                            ? dateKey(selected.validUntil)
                            : ""
                        }
                      />
                    </div>
                    <CheckboxField
                      name="roundGrandTotal"
                      label="Round the total to the nearest rupee"
                      defaultChecked={selected.roundGrandTotal}
                    />
                    <TextAreaField
                      name="terms"
                      label="Terms printed on this quotation"
                      rows={4}
                      defaultValue={selected.terms ?? ""}
                    />
                    <TextAreaField
                      name="notes"
                      label="Notes for the customer"
                      rows={2}
                      defaultValue={selected.notes ?? ""}
                    />
                  </ActionPanel>
                </div>
              </details>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
