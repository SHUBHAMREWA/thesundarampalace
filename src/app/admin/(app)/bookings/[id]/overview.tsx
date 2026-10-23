import en from "@messages/en.json";
import { ArrowDown, ArrowUp } from "lucide-react";

import { ActionPanel, ConfirmAction, InlineAction } from "@/components/crm/action-kit";
import { ReservationBadge } from "@/components/crm/status-badge";
import { Detail } from "@/components/crm/timeline";
import { SelectField, TextAreaField, TextField } from "@/components/forms/form-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhoneForDisplay } from "@/lib/contact/links";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { formatINR } from "@/lib/money";
import { guestCountLockDate, isFirm, isGuestCountLocked, isMarriageEvent, nextStatuses, plateDifference, type BookingStatus } from "@/lib/booking/rules";
import { dateKey, formatDateKey, formatIST, todayIST } from "@/lib/time";
import { GST_STATES, gstStateLabel } from "@/lib/validation/gst";
import {
  addSubEventAction,
  cancelBookingAction,
  changeStatusAction,
  checkAvailabilityAction,
  moveSubEventAction,
  recordPlatesAction,
  removeSubEventAction,
  renewHoldsAction,
  savePartyAction,
  setMenuAction,
  updateBookingAction,
  updateSubEventAction,
} from "@/server/actions/bookings";
import { billExtraPlatesAction } from "@/server/actions/money";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import { canEditBooking, cancellationQuote, type getBookingDetail, type MenuSnapshot } from "@/server/services/bookings";
import { parseSelectionRules } from "@/server/services/catalog";
import { labelOf, lookupOptions } from "@/server/services/lookups";
import { getSettings } from "@/server/services/settings";

import { MenuForm, type MenuPackageOption } from "./menu-form";
import { SubEventForm } from "./sub-event-form";

const COURSE_LABELS = en.catalog.course as Record<string, string>;
const STATUS_ACTION: Record<string, string> = {
  ENQUIRY_HOLD: "Back to enquiry hold",
  TENTATIVE: "Mark tentative",
  QUOTATION_SENT: "Mark quotation sent",
  CONFIRMED: "Confirm booking",
  IN_PROGRESS: "Event in progress",
  COMPLETED: "Mark completed",
};

type Booking = Awaited<ReturnType<typeof getBookingDetail>>;

export async function Overview({ booking, user }: { booking: Booking; user: CurrentUser }) {
  const editable = canEditBooking(user, booking.status);
  const [eventTypes, subTypes, halls, slots, staff, packages, menuPackages, policy] = await Promise.all([
    lookupOptions("event_type"),
    lookupOptions("sub_event_type"),
    db.hall.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isComposite: true } }),
    db.slotDefinition.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }] }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.package.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.menuPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, include: { menu: { include: { items: { orderBy: { sortOrder: "asc" } } } } } }),
    getSettings("bookingPolicy"),
  ]);
  const hallOptions = halls.map((h) => ({ value: h.id, label: `${t(h.name, "en")}${h.isComposite ? " (combined)" : ""}` }));
  const slotOptions = slots.map((s) => ({ id: s.id, hallId: s.hallId, label: `${s.name} (${s.startTime}–${s.endTime})` }));
  const staffOptions = staff.map((s) => ({ value: s.id, label: s.name }));
  const menuOptions: MenuPackageOption[] = menuPackages.map((p) => ({
    id: p.id,
    label: `${p.name} — ${t(p.menu.name, "en")} (${formatINR(p.perPlateRate)}/plate)`,
    minPlates: p.minPlates,
    rules: parseSelectionRules(p.selectionRules),
    items: p.menu.items.map((i) => ({ id: i.id, course: i.course, name: t(i.name, "en") })),
  }));
  const today = todayIST();
  const status = booking.status as BookingStatus;
  const next = nextStatuses(status).filter((s) => s !== "CANCELLED");
  const canCancel = can(user, "bookings.confirm") && nextStatuses(status).includes("CANCELLED");
  const quote = canCancel ? await cancellationQuote(user, booking.id) : null;
  const holdsExpired = booking.subEvents.some((s) => s.reservation?.state === "RELEASED");
  const cancellation = booking.cancellation as { reason?: string; agreedRefund?: string; computedRefund?: string; overridden?: boolean; overrideReason?: string | null } | null;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader><CardTitle>Functions</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {booking.subEvents.length ? null : <p className="text-sm text-text-muted">No functions yet. Add the first one below — each has its own date, hall and slot.</p>}
            {booking.subEvents.map((s, index) => {
              const selection = s.menuSelection;
              const snap = selection?.snapshot as unknown as MenuSnapshot | undefined;
              const locked = isGuestCountLocked(today, dateKey(s.date), policy.guestCountLockDays);
              const started = s.startsAt <= new Date();
              const diff = selection?.actualPlates != null ? plateDifference(selection.guaranteedPlates, selection.actualPlates) : null;
              return (
                <div key={s.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{s.name} <span className="font-normal text-text-muted">· {labelOf(subTypes, s.eventTypeKey)}</span></p>
                      <p className="text-sm">
                        {formatDateKey(dateKey(s.date), "EEE d MMM yyyy")} · {formatIST(s.startsAt, "h:mm a")} – {formatIST(s.endsAt, "h:mm a")}
                        {s.endsAt.getTime() - s.startsAt.getTime() > 0 && formatIST(s.endsAt, "yyyy-MM-dd") !== formatIST(s.startsAt, "yyyy-MM-dd") ? " (next day)" : ""}
                      </p>
                      <p className="text-sm text-text-muted">
                        {t(s.hall.name, "en")}{s.slotDefinition ? ` · ${s.slotDefinition.name}` : " · custom time"}
                        {s.expectedGuests ? ` · ${s.expectedGuests} guests` : ""}
                        {s.assignedTo ? ` · ${s.assignedTo.name}` : ""}
                      </p>
                      {s.reservation?.state === "HOLD" && s.reservation.holdExpiresAt && !s.reservation.waitlistPosition ? (
                        <p className="text-xs text-text-muted">Hold expires {formatIST(s.reservation.holdExpiresAt)}</p>
                      ) : null}
                      {s.reservation?.overrideReason ? <p className="text-xs text-warning">Clash overridden: {s.reservation.overrideReason}</p> : null}
                    </div>
                    <div className="flex items-center gap-1">
                      {s.reservation ? <ReservationBadge state={s.reservation.state} waitlistPosition={s.reservation.waitlistPosition} /> : null}
                      {editable ? (
                        <>
                          {index > 0 ? <InlineAction action={moveSubEventAction.bind(null, booking.id, s.id, "up")} variant="ghost" size="sm" aria-label={`Move ${s.name} up`}><ArrowUp aria-hidden="true" /></InlineAction> : null}
                          {index < booking.subEvents.length - 1 ? <InlineAction action={moveSubEventAction.bind(null, booking.id, s.id, "down")} variant="ghost" size="sm" aria-label={`Move ${s.name} down`}><ArrowDown aria-hidden="true" /></InlineAction> : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                  {snap ? (
                    <div className="mt-3 rounded-md bg-bg p-3 text-sm">
                      <p className="font-medium">{snap.packageName} — {snap.menuName} · {selection!.guaranteedPlates} plates guaranteed{can(user, "payments.read") || can(user, "quotations.create") ? ` · ${formatINR(snap.perPlateRate)}/plate` : ""}</p>
                      <p className="text-text-muted">{snap.items.map((i) => i.name).join(", ")}</p>
                      <p className="text-xs text-text-muted">Plates lock on {formatDateKey(guestCountLockDate(dateKey(s.date), policy.guestCountLockDays))}{locked ? " (locked)" : ""}</p>
                      {selection!.actualPlates != null ? (
                        <p className="mt-1">Served: {selection!.actualPlates}{diff?.extra ? ` · ${diff.extra} extra` : ""}{diff?.shortfall ? ` · ${diff.shortfall} fewer than guaranteed${policy.refundPlateShortfall ? " (policy: refundable)" : " (not refunded under the current policy)"}` : ""}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {editable ? (
                      <details className="w-full">
                        <summary className="cursor-pointer text-sm font-medium text-primary">Edit function</summary>
                        <div className="mt-3">
                          <SubEventForm
                            save={updateSubEventAction.bind(null, booking.id, s.id)}
                            check={checkAvailabilityAction.bind(null, booking.id)}
                            types={subTypes}
                            halls={hallOptions}
                            slots={slotOptions}
                            staff={staffOptions}
                            canOverride={can(user, "bookings.override_conflict")}
                            submitLabel="Save function"
                            defaults={{
                              name: s.name,
                              eventTypeKey: s.eventTypeKey,
                              date: dateKey(s.date),
                              hallId: s.hallId,
                              slotDefinitionId: s.slotDefinitionId ?? "",
                              customStart: s.slotDefinitionId ? "" : formatIST(s.startsAt, "HH:mm"),
                              customEnd: s.slotDefinitionId ? "" : formatIST(s.endsAt, "HH:mm"),
                              expectedGuests: s.expectedGuests?.toString() ?? "",
                              assignedToId: s.assignedToId ?? "",
                              specialInstructions: s.specialInstructions ?? "",
                              internalNotes: s.internalNotes ?? "",
                              dietaryNotes: s.dietaryNotes ?? "",
                            }}
                          />
                        </div>
                      </details>
                    ) : null}
                    {editable ? (
                      <details className="w-full">
                        <summary className="cursor-pointer text-sm font-medium text-primary">{snap ? "Change menu or plates" : "Choose menu"}</summary>
                        <div className="mt-3">
                          {menuOptions.length ? (
                            <MenuForm
                              action={setMenuAction.bind(null, booking.id, s.id)}
                              packages={menuOptions}
                              courseLabels={COURSE_LABELS}
                              lockNote={locked ? (can(user, "plates.change_after_lock") ? "The lock date has passed; changes are recorded in the audit log." : "The lock date has passed; a manager must change plates.") : null}
                              defaults={{
                                menuPackageId: selection?.menuPackageId ?? "",
                                itemIds: menuOptions.find((m) => m.id === selection?.menuPackageId)?.items.filter((i) => snap?.items.some((x) => x.name === i.name && x.course === i.course)).map((i) => i.id) ?? [],
                                guaranteedPlates: selection?.guaranteedPlates.toString() ?? s.expectedGuests?.toString() ?? "",
                              }}
                            />
                          ) : (
                            <p className="text-sm text-text-muted">No menu packages yet. Add them in Catalog and pricing.</p>
                          )}
                        </div>
                      </details>
                    ) : null}
                    {selection && isFirm(status) && started && can(user, "bookings.edit") ? (
                      <ActionPanel action={recordPlatesAction.bind(null, booking.id, s.id)} submitLabel="Record plates served" className="flex flex-wrap items-end gap-2">
                        <TextField name="actualPlates" label="Plates actually served" type="number" min={0} defaultValue={selection.actualPlates?.toString() ?? ""} />
                      </ActionPanel>
                    ) : null}
                    {diff?.extra && can(user, "payments.create") ? (
                      <ActionPanel action={billExtraPlatesAction.bind(null, booking.id, s.id)} submitLabel={`Bill ${diff.extra} extra plates`} money className="flex items-end gap-2">
                        <span className="sr-only">Adds a post-event charge at the agreed per-plate rate.</span>
                      </ActionPanel>
                    ) : null}
                    {editable ? (
                      <ConfirmAction
                        action={removeSubEventAction.bind(null, booking.id, s.id)}
                        label="Remove"
                        title={`Remove ${s.name}?`}
                        description="Its slot is released. Quotations already sent keep their lines."
                        reasonName="reason"
                        reasonLabel={isFirm(status) ? "Reason (required for confirmed bookings)" : "Reason (optional)"}
                        destructive
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
            {editable ? (
              <details open={!booking.subEvents.length} className="rounded-lg border border-dashed border-border p-4">
                <summary className="cursor-pointer text-sm font-medium text-primary">Add a function</summary>
                <div className="mt-4">
                  <SubEventForm
                    save={addSubEventAction.bind(null, booking.id)}
                    check={checkAvailabilityAction.bind(null, booking.id)}
                    types={subTypes}
                    halls={hallOptions}
                    slots={slotOptions}
                    staff={staffOptions}
                    canOverride={can(user, "bookings.override_conflict")}
                    submitLabel="Add function"
                    defaults={{ eventTypeKey: "", expectedGuests: booking.expectedGuests?.toString() ?? "" }}
                  />
                </div>
              </details>
            ) : null}
          </CardContent>
        </Card>

        {isMarriageEvent(booking.mainEventTypeKey) && can(user, "customers.read") ? (
          <Card>
            <CardHeader><CardTitle>Bride and groom</CardTitle></CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              {(["BRIDE", "GROOM"] as const).map((role) => {
                const party = booking.parties.find((p) => p.role === role);
                return (
                  <div key={role} className="space-y-3">
                    <h3 className="text-sm font-semibold">{role === "BRIDE" ? "Bride" : "Groom"}</h3>
                    {editable && can(user, "customers.edit") ? (
                      <ActionPanel action={savePartyAction.bind(null, booking.id)} submitLabel="Save">
                        <input type="hidden" name="role" value={role} />
                        <TextField name="fullName" label="Full name" defaultValue={party?.fullName} />
                        <TextField name="mobile" label="Mobile" type="tel" defaultValue={party?.mobile ?? ""} />
                        <TextField name="altPhone" label="Other contact" type="tel" defaultValue={party?.altPhone ?? ""} />
                        <TextField name="email" label="Email" type="email" defaultValue={party?.email ?? ""} />
                        <TextAreaField name="notes" label="Notes" rows={2} defaultValue={party?.notes ?? ""} />
                      </ActionPanel>
                    ) : party ? (
                      <dl className="space-y-1 text-sm">
                        <Detail label="Name">{party.fullName}</Detail>
                        <Detail label="Mobile">{party.mobile ? formatPhoneForDisplay(party.mobile) : "—"}</Detail>
                      </dl>
                    ) : (
                      <p className="text-sm text-text-muted">Not added.</p>
                    )}
                  </div>
                );
              })}
              <p className="text-xs text-text-muted md:col-span-2">ID documents for the bride or groom are uploaded on the customer&apos;s page and stay private.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {status === "CANCELLED" && cancellation ? (
              <div className="text-sm">
                <p>Cancelled {booking.cancelledAt ? formatIST(booking.cancelledAt, "d MMM yyyy") : ""} — {cancellation.reason}</p>
                <p>Refund agreed: <strong>{formatINR(cancellation.agreedRefund ?? "0")}</strong>{cancellation.overridden ? ` (policy gave ${formatINR(cancellation.computedRefund ?? "0")}; ${cancellation.overrideReason})` : ""}</p>
              </div>
            ) : null}
            {holdsExpired && status === "ENQUIRY_HOLD" ? <p className="text-sm text-warning">A hold expired and its slot was released.</p> : null}
            <div className="flex flex-wrap gap-2">
              {next.map((to) =>
                (to === "CONFIRMED" || !["ENQUIRY_HOLD", "TENTATIVE", "QUOTATION_SENT"].includes(status) ? can(user, "bookings.confirm") : to === "ENQUIRY_HOLD" ? can(user, "holds.place") : can(user, "bookings.edit")) ? (
                  <ConfirmAction
                    key={to}
                    action={changeStatusAction.bind(null, booking.id)}
                    label={STATUS_ACTION[to]}
                    title={`${STATUS_ACTION[to]}?`}
                    description={to === "CONFIRMED" ? "Every function's slot becomes confirmed and the current cancellation policy is attached to the booking." : undefined}
                    reasonName="reason"
                    reasonLabel="Note (optional)"
                    triggerVariant={to === "CONFIRMED" ? "default" : "outline"}
                  >
                    <input type="hidden" name="to" value={to} />
                    {to === "CONFIRMED" && can(user, "bookings.override_conflict") ? (
                      <TextAreaField name="overrideReason" label="Override a clash with another confirmed booking — reason (leave empty normally)" rows={2} />
                    ) : null}
                  </ConfirmAction>
                ) : null,
              )}
              {status === "ENQUIRY_HOLD" && can(user, "holds.place") ? (
                <InlineAction action={renewHoldsAction.bind(null, booking.id)} variant="outline" size="sm">Renew holds</InlineAction>
              ) : null}
              {canCancel && quote ? (
                <ConfirmAction
                  action={cancelBookingAction.bind(null, booking.id)}
                  label="Cancel booking"
                  title="Cancel this booking?"
                  description={
                    <div className="space-y-1">
                      <p>All slots are released. Refunds and credit notes are then recorded on the Money tab.</p>
                      <p>
                        {quote.hasPolicy
                          ? `Policy “${quote.policyName}”: ${quote.daysBefore} days before the first function → ${quote.refundPercent.toString()}% of ${formatINR(quote.netReceived)} received = ${formatINR(quote.refundAmount)}.`
                          : "No cancellation policy is attached, so the policy refund is ₹0.00. Enter the agreed amount below."}
                      </p>
                    </div>
                  }
                  reasonName="reason"
                  reasonRequired
                  destructive
                  confirmLabel="Cancel booking"
                >
                  <TextField name="agreedRefund" label="Refund to give (₹)" defaultValue={quote.refundAmount.toFixed(2)} inputMode="decimal" />
                  <TextAreaField name="overrideReason" label="If different from the policy: why?" rows={2} />
                </ConfirmAction>
              ) : null}
            </div>
            {booking.statusHistory.length ? (
              <ul className="space-y-1 border-t border-border pt-3 text-xs text-text-muted">
                {booking.statusHistory.slice(0, 6).map((h) => (
                  <li key={h.id}>{formatIST(h.createdAt, "d MMM, h:mm a")}: {h.fromStatus ? `${h.fromStatus} → ` : ""}{h.toStatus}{h.reason ? ` — ${h.reason}` : ""}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Booking details</CardTitle></CardHeader>
          <CardContent>
            <dl className="mb-4 grid gap-3 text-sm">
              <Detail label="Customer">{booking.customer ? `${booking.customer.fullName} · ${formatPhoneForDisplay(booking.customer.mobile)}` : "—"}</Detail>
              <Detail label="Event type">{labelOf(eventTypes, booking.mainEventTypeKey)}</Detail>
              <Detail label="Expected guests">{booking.expectedGuests ?? "—"}</Detail>
              <Detail label="Package">{booking.package ? t(booking.package.name, "en") : "—"}</Detail>
              <Detail label="Handled by">{booking.owner?.name ?? "—"}</Detail>
              <Detail label="Place of supply">{gstStateLabel(booking.placeOfSupplyStateCode)}</Detail>
              {can(user, "payments.read") ? <Detail label="Security deposit">{booking.depositRequired ? formatINR(booking.depositRequired) : "—"}</Detail> : null}
              {booking.lead ? <Detail label="From enquiry">{booking.lead.reference}</Detail> : null}
              {booking.notes ? <Detail label="Notes">{booking.notes}</Detail> : null}
              {booking.internalInstructions && can(user, "bookings.edit") ? <Detail label="Internal instructions">{booking.internalInstructions}</Detail> : null}
            </dl>
            {editable ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-primary">Edit details</summary>
                <div className="mt-4">
                  <ActionPanel action={updateBookingAction.bind(null, booking.id)} submitLabel="Save details">
                    <TextField name="mainEventName" label="Event name" defaultValue={booking.mainEventName} />
                    <SelectField name="mainEventTypeKey" label="Event type" options={eventTypes} defaultValue={booking.mainEventTypeKey} />
                    <TextField name="expectedGuests" label="Expected guests" type="number" min={1} defaultValue={booking.expectedGuests?.toString() ?? ""} />
                    <SelectField name="packageId" label="Package" options={packages.map((p) => ({ value: p.id, label: t(p.name, "en") }))} defaultValue={booking.packageId ?? ""} placeholder="—" />
                    <SelectField name="ownerId" label="Handled by" options={staffOptions} defaultValue={booking.ownerId ?? ""} placeholder="—" />
                    <SelectField name="placeOfSupplyStateCode" label="Place of supply" options={GST_STATES.map((s) => ({ value: s.code, label: `${s.name} (${s.code})` }))} defaultValue={booking.placeOfSupplyStateCode ?? ""} placeholder="—" />
                    <TextField name="depositRequired" label="Security deposit (₹)" inputMode="decimal" defaultValue={booking.depositRequired?.toFixed(2) ?? ""} />
                    <TextAreaField name="notes" label="Notes" rows={2} defaultValue={booking.notes ?? ""} />
                    <TextAreaField name="internalInstructions" label="Internal instructions" rows={2} defaultValue={booking.internalInstructions ?? ""} />
                  </ActionPanel>
                </div>
              </details>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
