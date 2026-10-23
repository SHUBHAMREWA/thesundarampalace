import { ArrowDown, ArrowUp, FileText } from "lucide-react";
import Link from "next/link";

import { ActionPanel, ConfirmAction, InlineAction } from "@/components/crm/action-kit";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/forms/form-kit";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { diffQuotationLines, totalDelta, type DiffLine } from "@/lib/booking/quote-diff";
import { db } from "@/lib/db";
import { formatINR, money } from "@/lib/money";
import { dateKey, formatDateKey, formatIST } from "@/lib/time";
import { GST_STATES, gstStateLabel } from "@/lib/validation/gst";
import {
  acceptVersionAction,
  addLineAction,
  createDraftAction,
  deleteDraftAction,
  fillFromBookingAction,
  markSentAction,
  moveLineAction,
  removeLineAction,
  updateDraftOptionsAction,
  updateLineAction,
} from "@/server/actions/quotations";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import type { getBookingDetail } from "@/server/services/bookings";
import { taxCategoriesWithRates } from "@/server/services/catalog";
import { listQuotations } from "@/server/services/quotations";
import { getSettings } from "@/server/services/settings";

import { LineForm, type ServiceOption } from "./line-form";

type Booking = Awaited<ReturnType<typeof getBookingDetail>>;

const STATUS_VARIANT = { DRAFT: "secondary", SENT: "warning", ACCEPTED: "success", SUPERSEDED: "outline" } as const;

export async function QuotationsTab({ booking, user, selectedId }: { booking: Booking; user: CurrentUser; selectedId?: string }) {
  const versions = await listQuotations(user, booking.id);
  const closed = booking.status === "CANCELLED" || booking.status === "COMPLETED";
  const canCreate = can(user, "quotations.create") && !closed;
  if (!versions.length) {
    return (
      <EmptyState
        icon={FileText}
        title="No quotation yet"
        description="Start a draft, add lines (or fill them from the functions' menus), then mark it as sent."
        action={canCreate ? <InlineAction action={createDraftAction.bind(null, booking.id)}>Start a quotation</InlineAction> : undefined}
      />
    );
  }
  const selected = versions.find((v) => v.id === selectedId) ?? versions.find((v) => v.status === "DRAFT") ?? versions.find((v) => v.status === "ACCEPTED") ?? versions[0];
  const previous = versions.find((v) => v.versionNumber === selected.versionNumber - 1);
  const isDraft = selected.status === "DRAFT" && canCreate;
  const [services, taxes, business] = await Promise.all([
    isDraft ? db.serviceItem.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }) : [],
    isDraft ? taxCategoriesWithRates() : [],
    getSettings("business"),
  ]);
  const serviceOptions: ServiceOption[] = services.map((s) => ({ id: s.id, name: s.name, label: `${s.name}${s.defaultPrice ? ` · ${formatINR(s.defaultPrice)}` : ""}`, unit: s.unit, defaultPrice: s.defaultPrice?.toFixed(2) ?? null, taxCategoryId: s.taxCategoryId }));
  const taxOptions = taxes.filter((t) => t.active && t.currentRate).map((t) => ({ value: t.id, label: `${t.name} — SAC ${t.sacCode}, ${t.currentRate!.ratePercent.toString()}%` }));
  const functionOptions = booking.subEvents.map((s) => ({ value: s.id, label: `${s.name} · ${formatDateKey(dateKey(s.date), "d MMM")}` }));
  const asDiff = (l: (typeof selected.lines)[number]): DiffLine => ({ kind: l.kind, subEventLabel: l.subEventLabel, description: l.description, quantity: l.quantity.toString(), unitPrice: l.unitPrice.toFixed(2), lineTotal: l.lineTotal.toFixed(2) });
  const changes = previous ? diffQuotationLines(previous.lines.map(asDiff), selected.lines.map(asDiff)) : [];
  const intra = selected.supplyType === "INTRA";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {versions.map((v) => (
          <Link
            key={v.id}
            href={`/admin/bookings/${booking.id}?tab=quotations&v=${v.id}`}
            aria-current={v.id === selected.id ? "page" : undefined}
            className={`rounded-md border px-3 py-1.5 text-sm ${v.id === selected.id ? "border-primary bg-blush text-primary" : "border-border bg-surface hover:border-primary"}`}
          >
            v{v.versionNumber} · {formatINR(v.grandTotal)} <Badge variant={STATUS_VARIANT[v.status]} className="ml-1">{v.status.toLowerCase()}</Badge>
          </Link>
        ))}
        {canCreate && !versions.some((v) => v.status === "DRAFT") ? (
          <InlineAction action={createDraftAction.bind(null, booking.id)} fields={{ copyFrom: selected.id }} variant="outline" size="sm">
            New version from v{selected.versionNumber}
          </InlineAction>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Version {selected.versionNumber}</CardTitle>
            <p className="text-sm text-text-muted">
              {selected.pricesIncludeTax ? "Prices include GST" : "GST added on top"} · {intra ? "intra-state (CGST + SGST)" : "inter-state (IGST)"} · place of supply {gstStateLabel(selected.placeOfSupplyStateCode)}
              {selected.validUntil ? ` · valid until ${formatDateKey(dateKey(selected.validUntil))}` : ""}
            </p>
            <p className="text-xs text-text-muted">
              {selected.sentAt ? `Sent ${formatIST(selected.sentAt)}. ` : ""}
              {selected.acceptedAt ? `Accepted ${formatIST(selected.acceptedAt)}.` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isDraft ? (
              <>
                <InlineAction action={fillFromBookingAction.bind(null, booking.id, selected.id)} variant="outline" size="sm">Fill from menus and package</InlineAction>
                <ConfirmAction
                  action={markSentAction.bind(null, booking.id, selected.id)}
                  label="Mark as sent"
                  title={`Send version ${selected.versionNumber}?`}
                  description="It is frozen once sent. To change prices later you create a new version."
                  triggerVariant="default"
                />
                <ConfirmAction action={deleteDraftAction.bind(null, booking.id, selected.id)} label="Discard draft" title="Discard this draft?" destructive />
              </>
            ) : null}
            {selected.status === "SENT" && can(user, "quotations.accept") && !closed ? (
              <ConfirmAction
                action={acceptVersionAction.bind(null, booking.id, selected.id)}
                label="Customer accepted"
                title={`Record acceptance of version ${selected.versionNumber}?`}
                description={`The booking's agreed total becomes ${formatINR(selected.grandTotal)}.${booking.acceptedQuotationId ? " The previously accepted version is superseded." : ""}`}
                triggerVariant="default"
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!business.stateCode ? (
            <p className="rounded-md border border-warning/40 p-3 text-sm text-warning">
              The venue&apos;s GST state isn&apos;t set (Settings → Business details), so choose intra- or inter-state supply yourself.
            </p>
          ) : null}
          {selected.lines.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="hidden text-right md:table-cell">Discount</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">Taxable</TableHead>
                    <TableHead className="hidden text-right lg:table-cell">GST</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {isDraft ? <TableHead><span className="sr-only">Actions</span></TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selected.lines.map((l, i) => {
                    const discount = money(l.discount).plus(money(l.allocatedDiscount));
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <p className="font-medium">{l.description}</p>
                          <p className="text-xs text-text-muted">{[l.subEventLabel, `SAC ${l.sacCode}`, l.kind.toLowerCase().replace("_", " ")].filter(Boolean).join(" · ")}</p>
                          {isDraft ? (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-primary">Edit line</summary>
                              <div className="mt-2">
                                <LineForm
                                  action={updateLineAction.bind(null, booking.id, l.id)}
                                  services={[]}
                                  taxCategories={taxOptions}
                                  functions={functionOptions}
                                  submitLabel="Save line"
                                  defaults={{ kind: l.kind, subEventId: l.subEventId ?? "", description: l.description, unit: l.unit, quantity: l.quantity.toString(), unitPrice: l.unitPrice.toFixed(2), discount: l.discount.toFixed(2), taxCategoryId: l.taxCategoryId ?? "" }}
                                />
                              </div>
                            </details>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{l.quantity.toString()} {l.unit}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatINR(l.unitPrice)}</TableCell>
                        <TableCell className="hidden text-right whitespace-nowrap md:table-cell">{discount.isZero() ? "—" : formatINR(discount)}</TableCell>
                        <TableCell className="hidden text-right whitespace-nowrap lg:table-cell">{formatINR(l.taxableValue)}</TableCell>
                        <TableCell className="hidden text-right whitespace-nowrap lg:table-cell">
                          {l.taxRatePercent.toString()}% · {formatINR(money(l.cgst).plus(l.sgst).plus(l.igst))}
                        </TableCell>
                        <TableCell className="text-right font-medium whitespace-nowrap">{formatINR(l.lineTotal)}</TableCell>
                        {isDraft ? (
                          <TableCell className="whitespace-nowrap">
                            {i > 0 ? <InlineAction action={moveLineAction.bind(null, booking.id, l.id, "up")} variant="ghost" size="sm" aria-label="Move up"><ArrowUp aria-hidden="true" /></InlineAction> : null}
                            {i < selected.lines.length - 1 ? <InlineAction action={moveLineAction.bind(null, booking.id, l.id, "down")} variant="ghost" size="sm" aria-label="Move down"><ArrowDown aria-hidden="true" /></InlineAction> : null}
                            <InlineAction action={removeLineAction.bind(null, booking.id, l.id)} variant="ghost" size="sm" className="text-danger">Remove</InlineAction>
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
            <dt className="text-text-muted">Subtotal</dt><dd className="text-right">{formatINR(selected.subtotal)}</dd>
            {!money(selected.discountTotal).isZero() ? (<><dt className="text-text-muted">Discounts</dt><dd className="text-right">− {formatINR(selected.discountTotal)}</dd></>) : null}
            <dt className="text-text-muted">Taxable value</dt><dd className="text-right">{formatINR(selected.taxableTotal)}</dd>
            {intra ? (
              <>
                <dt className="text-text-muted">CGST</dt><dd className="text-right">{formatINR(selected.cgstTotal)}</dd>
                <dt className="text-text-muted">SGST</dt><dd className="text-right">{formatINR(selected.sgstTotal)}</dd>
              </>
            ) : (
              <><dt className="text-text-muted">IGST</dt><dd className="text-right">{formatINR(selected.igstTotal)}</dd></>
            )}
            {!money(selected.roundOff).isZero() ? (<><dt className="text-text-muted">Round-off</dt><dd className="text-right">{formatINR(selected.roundOff)}</dd></>) : null}
            <dt className="border-t border-border pt-1 font-semibold">Total</dt><dd className="border-t border-border pt-1 text-right font-semibold">{formatINR(selected.grandTotal)}</dd>
          </dl>

          {isDraft ? (
            <>
              <div className="rounded-lg border border-dashed border-border p-4">
                <h3 className="mb-3 text-sm font-semibold">Add a line</h3>
                {taxOptions.length ? (
                  <LineForm action={addLineAction.bind(null, booking.id, selected.id)} services={serviceOptions} taxCategories={taxOptions} functions={functionOptions} submitLabel="Add line" reset />
                ) : (
                  <p className="text-sm text-text-muted">Add a tax category with a rate in Catalog and pricing → Taxes first (confirmed by your accountant).</p>
                )}
              </div>
              <details className="rounded-lg border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium text-primary">Quotation options (GST, discount, terms)</summary>
                <div className="mt-4">
                  <ActionPanel action={updateDraftOptionsAction.bind(null, booking.id, selected.id)} submitLabel="Save options">
                    <div className="grid gap-4 md:grid-cols-2">
                      <SelectField name="placeOfSupplyStateCode" label="Place of supply" options={GST_STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))} defaultValue={selected.placeOfSupplyStateCode} placeholder="Choose…" />
                      {!business.stateCode ? (
                        <SelectField name="supplyType" label="Supply type" options={[{ value: "INTRA", label: "Intra-state (CGST + SGST)" }, { value: "INTER", label: "Inter-state (IGST)" }]} defaultValue={selected.supplyType} />
                      ) : null}
                      <TextField name="bookingDiscount" label="Overall discount (₹, spread over lines before tax)" inputMode="decimal" defaultValue={selected.bookingDiscount.toFixed(2)} />
                      <TextField name="validUntil" label="Valid until" type="date" defaultValue={selected.validUntil ? dateKey(selected.validUntil) : ""} />
                    </div>
                    <CheckboxField name="pricesIncludeTax" label="Entered prices already include GST" defaultChecked={selected.pricesIncludeTax} />
                    <CheckboxField name="roundGrandTotal" label="Round the total to the nearest rupee" defaultChecked={selected.roundGrandTotal} />
                    <TextAreaField name="terms" label="Terms printed on this quotation" rows={4} defaultValue={selected.terms ?? ""} />
                    <TextAreaField name="notes" label="Notes for the customer" rows={2} defaultValue={selected.notes ?? ""} />
                  </ActionPanel>
                </div>
              </details>
            </>
          ) : null}
        </CardContent>
      </Card>

      {previous ? (
        <Card>
          <CardHeader>
            <CardTitle>Changes from v{previous.versionNumber}</CardTitle>
            <p className="text-sm text-text-muted">Total {formatINR(previous.grandTotal)} → {formatINR(selected.grandTotal)} ({money(totalDelta(previous.grandTotal.toFixed(2), selected.grandTotal.toFixed(2))).isNegative() ? "" : "+"}{formatINR(totalDelta(previous.grandTotal.toFixed(2), selected.grandTotal.toFixed(2)))})</p>
          </CardHeader>
          <CardContent>
            {changes.length ? (
              <ul className="space-y-1 text-sm">
                {changes.map((c, i) => (
                  <li key={i}>
                    {c.type === "added" ? <><Badge variant="success">Added</Badge> {c.line.description} — {formatINR(c.line.lineTotal)}</> : null}
                    {c.type === "removed" ? <><Badge variant="danger">Removed</Badge> {c.line.description} — {formatINR(c.line.lineTotal)}</> : null}
                    {c.type === "changed" ? (
                      <><Badge variant="warning">Changed</Badge> {c.after.description}: {c.fields.includes("quantity") ? `qty ${c.before.quantity} → ${c.after.quantity}; ` : ""}{c.fields.includes("unitPrice") ? `rate ${formatINR(c.before.unitPrice)} → ${formatINR(c.after.unitPrice)}; ` : ""}total {formatINR(c.before.lineTotal)} → {formatINR(c.after.lineTotal)}</>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">The lines are the same.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
