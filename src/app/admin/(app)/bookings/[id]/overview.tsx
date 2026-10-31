import en from "@messages/en.json";
import {
  ChevronDown,
  ArrowDown,
  ArrowUp,
  CalendarRange,
  CircleAlert,
  CircleCheck,
  ClipboardList,
  Download,
  Eye,
  FileLock2,
  Flag,
  Heart,
  Printer,
} from "lucide-react";

import {
  ActionPanel,
  ConfirmAction,
  InlineAction,
} from "@/components/crm/action-kit";
import { ImageViewer } from "@/components/crm/image-viewer";
import { SectionTitle } from "@/components/crm/person-avatar";
import { ReservationBadge } from "@/components/crm/status-badge";
import { Detail } from "@/components/crm/timeline";
import { CompressedFileField } from "@/components/forms/compressed-file-field";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/forms/form-kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPhoneForDisplay } from "@/lib/contact/links";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { formatINR } from "@/lib/money";
import { DOCUMENT_TYPES } from "@/lib/pdf/fields";
import {
  guestCountLockDate,
  isFirm,
  isGuestCountLocked,
  isMarriageEvent,
  isStepBack,
  nextStatuses,
  plateDifference,
  type BookingStatus,
} from "@/lib/booking/rules";
import { dateKey, formatDateKey, formatIST, todayIST } from "@/lib/time";
import {
  addSubEventAction,
  cancelBookingAction,
  changeStatusAction,
  checkAvailabilityAction,
  deletePartyDocumentAction,
  moveSubEventAction,
  recordPlatesAction,
  removeSubEventAction,
  savePartyAction,
  setMenuAction,
  updateBookingAction,
  updateSubEventAction,
  uploadPartyDocumentAction,
} from "@/server/actions/bookings";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import {
  canEditBooking,
  cancellationQuote,
  type getBookingDetail,
  type MenuSnapshot,
} from "@/server/services/bookings";
import { parseSelectionRules } from "@/server/services/catalog";
import {
  DOCUMENT_CATEGORIES,
  partyDocuments,
} from "@/server/services/customers";
import { labelOf, lookupOptions } from "@/server/services/lookups";
import { getSettings } from "@/server/services/settings";

import { MenuForm, type MenuPackageOption } from "./menu-form";
import { SubEventForm } from "./sub-event-form";

/** Food Menu preview (no prices) with its default fields; more options are in the Documents tab. */
function menuSheet(bookingId: string, template: "elegant" | "plain"): string {
  const params = new URLSearchParams({ bookingId, type: "menu", template });
  for (const field of DOCUMENT_TYPES.menu.defaults) params.append("f", field);
  return params.toString();
}

const COURSE_LABELS = en.catalog.course as Record<string, string>;
const STATUS_ACTION: Record<string, string> = {
  ENQUIRY_HOLD: "Back to enquiry hold",
  TENTATIVE: "Mark booked",
  QUOTATION_SENT: "Mark quotation sent",
  CONFIRMED: "Mark as booked",
  IN_PROGRESS: "Event in progress",
  COMPLETED: "Mark completed",
};

/** Plain names for the status history. */
const STATUS_NAME: Record<string, string> = {
  ENQUIRY_HOLD: "Not booked yet",
  TENTATIVE: "Not booked yet",
  QUOTATION_SENT: "Not booked yet",
  CONFIRMED: "Booked",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

/** Button label for undoing a cancellation made by mistake. */
const RESTORE_ACTION = "Restore booking (mark as booked)";

/** Button labels for moving a firm booking back (undoing a status set by mistake). */
const STEP_BACK_ACTION: Record<string, string> = {
  CONFIRMED: "Back to confirmed",
  TENTATIVE: "Un-confirm (back to booked)",
};

type Booking = Awaited<ReturnType<typeof getBookingDetail>>;

export async function Overview({
  booking,
  user,
}: {
  booking: Booking;
  user: CurrentUser;
}) {
  const editable = canEditBooking(user, booking.status);
  const [eventTypes, subTypes, halls, staff, menuPackages, policy] =
    await Promise.all([
      lookupOptions("event_type"),
      lookupOptions("sub_event_type"),
      db.hall.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, isComposite: true },
      }),
      db.user.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.menuPackage.findMany({
        where: { active: true },
        orderBy: { sortOrder: "asc" },
        include: {
          menu: { include: { items: { orderBy: { sortOrder: "asc" } } } },
        },
      }),
      getSettings("bookingPolicy"),
    ]);
  const hallOptions = halls.map((h) => ({
    value: h.id,
    label: `${t(h.name, "en")}${h.isComposite ? " (combined)" : ""}`,
  }));
  const staffOptions = staff.map((s) => ({ value: s.id, label: s.name }));
  const menuOptions: MenuPackageOption[] = menuPackages.map((p) => ({
    id: p.id,
    label: `${p.name} — ${t(p.menu.name, "en")} (${formatINR(p.perPlateRate)}/plate)`,
    minPlates: p.minPlates,
    rules: parseSelectionRules(p.selectionRules),
    items: p.menu.items.map((i) => ({
      id: i.id,
      course: i.course,
      name: t(i.name, "en"),
    })),
  }));
  const today = todayIST();
  const status = booking.status as BookingStatus;
  // Three statuses: Booked → Completed, or Cancelled (its own button below).
  // Older not-yet-booked records get one "Mark as booked" button.
  const next = nextStatuses(status).filter((s) =>
    s === "CONFIRMED" ? !isFirm(status) : s === "COMPLETED",
  );
  const canCancel =
    can(user, "bookings.confirm") && nextStatuses(status).includes("CANCELLED");
  const quote = canCancel ? await cancellationQuote(user, booking.id) : null;
  const holdsExpired = booking.subEvents.some(
    (s) => s.reservation?.state === "RELEASED",
  );
  const marriage =
    isMarriageEvent(booking.mainEventTypeKey) && can(user, "customers.read");
  const idDocs = marriage ? await partyDocuments(user, booking.id) : null;
  const canUploadIds = can(user, "documents.sensitive.upload");
  const cancellation = booking.cancellation as {
    reason?: string;
    agreedRefund?: string;
    computedRefund?: string;
    overridden?: boolean;
    overrideReason?: string | null;
  } | null;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>
              <SectionTitle icon={CalendarRange} tone="blue">
                Functions
              </SectionTitle>
            </CardTitle>
            {can(user, "pdf.menu") &&
            booking.subEvents.some((s) => s.menuSelection) ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/api/documents/preview?${menuSheet(booking.id, "elegant")}`}
                    target="_blank"
                    rel="noopener"
                  >
                    <Printer aria-hidden="true" /> Print menu
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a
                    href={`/api/documents/preview?${menuSheet(booking.id, "plain")}`}
                    target="_blank"
                    rel="noopener"
                  >
                    Plain menu for caterer
                  </a>
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span>
                <span className="text-text-muted">Booked on: </span>
                <span className="font-medium">
                  {booking.bookedOn
                    ? formatDateKey(dateKey(booking.bookedOn), "d MMM yyyy")
                    : formatIST(booking.createdAt, "d MMM yyyy")}
                </span>
              </span>
              <span>
                <span className="text-text-muted">Event: </span>
                <span className="font-medium">
                  {booking.startDate
                    ? dateKey(booking.startDate) ===
                      dateKey(booking.endDate ?? booking.startDate)
                      ? formatDateKey(
                          dateKey(booking.startDate),
                          "EEE d MMM yyyy",
                        )
                      : `${formatDateKey(dateKey(booking.startDate), "d MMM")} – ${formatDateKey(dateKey(booking.endDate!), "d MMM yyyy")}`
                    : "Not set yet"}
                </span>
              </span>
            </p>
            {booking.subEvents.length ? null : (
              <p className="text-sm text-text-muted">
                No functions yet. Add the first one below — each has its own
                date, hall and timing.
              </p>
            )}
            {booking.subEvents.map((s, index) => {
              const selection = s.menuSelection;
              const snap = selection?.snapshot as unknown as
                MenuSnapshot | undefined;
              const locked = isGuestCountLocked(
                today,
                dateKey(s.date),
                policy.guestCountLockDays,
              );
              const started = s.startsAt <= new Date();
              const diff =
                selection?.actualPlates != null
                  ? plateDifference(
                      selection.guaranteedPlates,
                      selection.actualPlates,
                    )
                  : null;
              return (
                <div key={s.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {s.name}{" "}
                        <span className="font-normal text-text-muted">
                          · {labelOf(subTypes, s.eventTypeKey)}
                        </span>
                      </p>
                      <p className="text-sm">
                        {formatDateKey(dateKey(s.date), "EEE d MMM yyyy")} ·{" "}
                        {formatIST(s.startsAt, "h:mm a")} –{" "}
                        {formatIST(s.endsAt, "h:mm a")}
                        {s.endsAt.getTime() - s.startsAt.getTime() > 0 &&
                        formatIST(s.endsAt, "yyyy-MM-dd") !==
                          formatIST(s.startsAt, "yyyy-MM-dd")
                          ? " (next day)"
                          : ""}
                      </p>
                      <p className="text-sm text-text-muted">
                        {t(s.hall.name, "en")}
                        {s.expectedGuests
                          ? ` · ${s.expectedGuests} guests`
                          : ""}
                        {s.assignedTo ? ` · ${s.assignedTo.name}` : ""}
                      </p>
                      {s.reservation?.state === "HOLD" &&
                      s.reservation.holdExpiresAt &&
                      !s.reservation.waitlistPosition ? (
                        <p className="text-xs text-text-muted">
                          Hold expires {formatIST(s.reservation.holdExpiresAt)}
                        </p>
                      ) : null}
                      {s.reservation?.overrideReason ? (
                        <p className="text-xs text-warning">
                          Clash overridden: {s.reservation.overrideReason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      {s.reservation ? (
                        <ReservationBadge
                          state={s.reservation.state}
                          waitlistPosition={s.reservation.waitlistPosition}
                        />
                      ) : null}
                      {editable ? (
                        <>
                          {index > 0 ? (
                            <InlineAction
                              action={moveSubEventAction.bind(
                                null,
                                booking.id,
                                s.id,
                                "up",
                              )}
                              variant="ghost"
                              size="sm"
                              aria-label={`Move ${s.name} up`}
                            >
                              <ArrowUp aria-hidden="true" />
                            </InlineAction>
                          ) : null}
                          {index < booking.subEvents.length - 1 ? (
                            <InlineAction
                              action={moveSubEventAction.bind(
                                null,
                                booking.id,
                                s.id,
                                "down",
                              )}
                              variant="ghost"
                              size="sm"
                              aria-label={`Move ${s.name} down`}
                            >
                              <ArrowDown aria-hidden="true" />
                            </InlineAction>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </div>
                  {snap ? (
                    <div className="mt-3 rounded-md bg-bg p-3 text-sm">
                      <p className="font-medium">
                        {snap.packageName} — {snap.menuName} ·{" "}
                        {selection!.guaranteedPlates} plates guaranteed
                        {can(user, "payments.read") ||
                        can(user, "quotations.create")
                          ? ` · ${formatINR(snap.perPlateRate)}/plate`
                          : ""}
                      </p>
                      <p className="text-text-muted">
                        {snap.items.map((i) => i.name).join(", ")}
                      </p>
                      <p className="text-xs text-text-muted">
                        Plates lock on{" "}
                        {formatDateKey(
                          guestCountLockDate(
                            dateKey(s.date),
                            policy.guestCountLockDays,
                          ),
                        )}
                        {locked ? " (locked)" : ""}
                      </p>
                      {selection!.actualPlates != null ? (
                        <p className="mt-1">
                          Served: {selection!.actualPlates}
                          {diff?.extra ? ` · ${diff.extra} extra` : ""}
                          {diff?.shortfall
                            ? ` · ${diff.shortfall} fewer than guaranteed${policy.refundPlateShortfall ? " (policy: refundable)" : " (not refunded under the current policy)"}`
                            : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {editable ? (
                      <details className="w-full">
                        <summary className="cursor-pointer text-sm font-medium text-primary">
                          Edit function
                        </summary>
                        <div className="mt-3">
                          <SubEventForm
                            save={updateSubEventAction.bind(
                              null,
                              booking.id,
                              s.id,
                            )}
                            check={checkAvailabilityAction.bind(
                              null,
                              booking.id,
                            )}
                            types={subTypes}
                            halls={hallOptions}
                            staff={staffOptions}
                            canOverride={can(
                              user,
                              "bookings.override_conflict",
                            )}
                            submitLabel="Save function"
                            defaults={{
                              name: s.name,
                              eventTypeKey: s.eventTypeKey,
                              date: dateKey(s.date),
                              hallId: s.hallId,
                              startTime: formatIST(s.startsAt, "HH:mm"),
                              endTime: formatIST(s.endsAt, "HH:mm"),
                              expectedGuests:
                                s.expectedGuests?.toString() ?? "",
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
                        <summary className="cursor-pointer text-sm font-medium text-primary">
                          {snap ? "Change menu or plates" : "Choose menu"}
                        </summary>
                        <div className="mt-3">
                          {menuOptions.length ? (
                            <MenuForm
                              action={setMenuAction.bind(
                                null,
                                booking.id,
                                s.id,
                              )}
                              packages={menuOptions}
                              courseLabels={COURSE_LABELS}
                              lockNote={
                                locked
                                  ? can(user, "plates.change_after_lock")
                                    ? "The lock date has passed; changes are recorded in the audit log."
                                    : "The lock date has passed; a manager must change plates."
                                  : null
                              }
                              defaults={{
                                menuPackageId: selection?.menuPackageId ?? "",
                                itemIds:
                                  menuOptions
                                    .find(
                                      (m) => m.id === selection?.menuPackageId,
                                    )
                                    ?.items.filter((i) =>
                                      snap?.items.some(
                                        (x) =>
                                          !x.extra &&
                                          x.name === i.name &&
                                          x.course === i.course,
                                      ),
                                    )
                                    .map((i) => i.id) ?? [],
                                extraDishes: Object.fromEntries(
                                  Object.entries(
                                    Object.groupBy(
                                      snap?.items.filter((x) => x.extra) ?? [],
                                      (x) => x.course,
                                    ),
                                  ).map(([course, dishes]) => [
                                    course,
                                    (dishes ?? [])
                                      .map((d) => d.name)
                                      .join(", "),
                                  ]),
                                ),
                                guaranteedPlates:
                                  selection?.guaranteedPlates.toString() ??
                                  s.expectedGuests?.toString() ??
                                  "",
                              }}
                            />
                          ) : (
                            <p className="text-sm text-text-muted">
                              No menu packages yet. Add them in Catalog and
                              pricing.
                            </p>
                          )}
                        </div>
                      </details>
                    ) : null}
                    {selection &&
                    isFirm(status) &&
                    started &&
                    can(user, "bookings.edit") ? (
                      <ActionPanel
                        action={recordPlatesAction.bind(null, booking.id, s.id)}
                        submitLabel="Record plates served"
                        className="flex flex-wrap items-end gap-2"
                      >
                        <TextField
                          name="actualPlates"
                          label="Plates actually served"
                          type="number"
                          min={0}
                          defaultValue={
                            selection.actualPlates?.toString() ?? ""
                          }
                        />
                      </ActionPanel>
                    ) : null}
                    {editable ? (
                      <ConfirmAction
                        action={removeSubEventAction.bind(
                          null,
                          booking.id,
                          s.id,
                        )}
                        label="Remove"
                        title={`Remove ${s.name}?`}
                        description="Its hall booking is released. Quotations already sent keep their lines."
                        reasonName="reason"
                        reasonLabel={
                          isFirm(status)
                            ? "Reason (required for confirmed bookings)"
                            : "Reason (optional)"
                        }
                        destructive
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
            {editable ? (
              <details className="rounded-lg border border-dashed border-border p-4">
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  Add a function
                </summary>
                <div className="mt-4">
                  <SubEventForm
                    save={addSubEventAction.bind(null, booking.id)}
                    check={checkAvailabilityAction.bind(null, booking.id)}
                    types={subTypes}
                    halls={hallOptions}
                    staff={staffOptions}
                    canOverride={can(user, "bookings.override_conflict")}
                    submitLabel="Add function"
                    defaults={{
                      eventTypeKey: "",
                      // New functions start on the booking date (the last function's date once there are some).
                      date: booking.subEvents.length
                        ? dateKey(
                            booking.subEvents[booking.subEvents.length - 1]
                              .date,
                          )
                        : booking.startDate
                          ? dateKey(booking.startDate)
                          : undefined,
                      expectedGuests: booking.expectedGuests?.toString() ?? "",
                    }}
                  />
                </div>
              </details>
            ) : null}
          </CardContent>
        </Card>

        {marriage ? (
          <Card>
            {/* Closed by default so the page stays short; click the heading to open. */}
            <details className="group">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle>
                    <SectionTitle icon={Heart} tone="rose">
                      Bride and groom
                    </SectionTitle>
                  </CardTitle>
                  <ChevronDown
                    className="size-5 text-text-muted transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </CardHeader>
              </summary>
              <CardContent className="mt-4 grid gap-6 md:grid-cols-2">
                {(["BRIDE", "GROOM"] as const).map((role) => {
                  const party = booking.parties.find((p) => p.role === role);
                  const docs = party ? (idDocs?.get(party.id) ?? []) : [];
                  const hasId = docs.some((d) => d.category !== "PHOTO");
                  const checks = [
                    { label: "Name", done: Boolean(party) },
                    { label: "Mobile", done: Boolean(party?.mobile) },
                    ...(idDocs ? [{ label: "ID document", done: hasId }] : []),
                  ];
                  return (
                    <div key={role} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          {role === "BRIDE" ? "Bride" : "Groom"}
                        </h3>
                        <ul
                          className="flex flex-wrap gap-1.5"
                          aria-label={`${role === "BRIDE" ? "Bride" : "Groom"} details checklist`}
                        >
                          {checks.map((c) => (
                            <li
                              key={c.label}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.done ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}
                            >
                              {c.done ? (
                                <CircleCheck
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              ) : (
                                <CircleAlert
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                              )}
                              {c.label}
                              <span className="sr-only">
                                {c.done ? " added" : " missing"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {editable && can(user, "customers.edit") ? (
                        <ActionPanel
                          action={savePartyAction.bind(null, booking.id)}
                          submitLabel="Save"
                        >
                          <input type="hidden" name="role" value={role} />
                          <TextField
                            name="fullName"
                            label="Full name"
                            defaultValue={party?.fullName}
                          />
                          <TextField
                            name="mobile"
                            label="Mobile"
                            type="tel"
                            defaultValue={party?.mobile ?? ""}
                          />
                          <TextField
                            name="altPhone"
                            label="Other contact"
                            type="tel"
                            defaultValue={party?.altPhone ?? ""}
                          />
                          <TextField
                            name="email"
                            label="Email"
                            type="email"
                            defaultValue={party?.email ?? ""}
                          />
                          <TextAreaField
                            name="notes"
                            label="Notes"
                            rows={2}
                            defaultValue={party?.notes ?? ""}
                          />
                        </ActionPanel>
                      ) : party ? (
                        <dl className="space-y-1 text-sm">
                          <Detail label="Name">{party.fullName}</Detail>
                          <Detail label="Mobile">
                            {party.mobile
                              ? formatPhoneForDisplay(party.mobile)
                              : "—"}
                          </Detail>
                        </dl>
                      ) : (
                        <p className="text-sm text-text-muted">Not added.</p>
                      )}
                      {idDocs ? (
                        <div className="space-y-3 rounded-lg border border-border bg-bg p-3">
                          <p className="flex items-center gap-1.5 text-sm font-medium">
                            <FileLock2
                              className="size-4 text-primary"
                              aria-hidden="true"
                            />{" "}
                            ID documents and photos
                          </p>
                          {docs.length ? (
                            <ul className="divide-y divide-border text-sm">
                              {docs.map((d) => (
                                <li
                                  key={d.id}
                                  className="flex items-start justify-between gap-2 py-2"
                                >
                                  {d.mimeType.startsWith("image/") ? (
                                    <ImageViewer
                                      src={`/api/private-files/${d.id}?view=1`}
                                      title={
                                        DOCUMENT_CATEGORIES.find(
                                          (x) => x.value === d.category,
                                        )?.label ?? d.fileName
                                      }
                                      downloadHref={`/api/private-files/${d.id}`}
                                      label={`Open ${d.fileName}`}
                                      className="shrink-0"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element -- private, permission-checked preview */}
                                      <img
                                        src={`/api/private-files/${d.id}?thumb=1`}
                                        alt=""
                                        loading="lazy"
                                        className="size-16 rounded-md border border-border bg-surface object-cover"
                                      />
                                    </ImageViewer>
                                  ) : null}
                                  <div className="min-w-0 flex-1">
                                    <p className="font-medium">
                                      {DOCUMENT_CATEGORIES.find(
                                        (x) => x.value === d.category,
                                      )?.label ?? d.category}
                                      {d.label ? ` — ${d.label}` : ""}
                                    </p>
                                    {d.idNumber ? (
                                      <p className="font-mono text-xs">
                                        {d.idNumber}
                                      </p>
                                    ) : null}
                                    <p className="truncate text-xs text-text-muted">
                                      {d.fileName} ·{" "}
                                      {formatIST(d.createdAt, "d MMM yyyy")}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    {d.mimeType.startsWith("image/") ? (
                                      <ImageViewer
                                        src={`/api/private-files/${d.id}?view=1`}
                                        title={
                                          DOCUMENT_CATEGORIES.find(
                                            (x) => x.value === d.category,
                                          )?.label ?? d.fileName
                                        }
                                        downloadHref={`/api/private-files/${d.id}`}
                                        label={`View ${d.fileName}`}
                                        className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent"
                                      >
                                        <Eye
                                          className="size-4"
                                          aria-hidden="true"
                                        />
                                      </ImageViewer>
                                    ) : null}
                                    <Button asChild variant="ghost" size="sm">
                                      <a
                                        href={`/api/private-files/${d.id}`}
                                        aria-label={`Download ${d.fileName}`}
                                      >
                                        <Download aria-hidden="true" />
                                      </a>
                                    </Button>
                                    {canUploadIds ? (
                                      <ConfirmAction
                                        action={deletePartyDocumentAction.bind(
                                          null,
                                          booking.id,
                                          d.id,
                                        )}
                                        label="Delete"
                                        title="Delete this document?"
                                        description="The file is removed from storage. A record that it existed (and who deleted it) is kept."
                                        reasonName="reason"
                                        reasonRequired
                                        destructive
                                      />
                                    ) : null}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-text-muted">
                              Nothing uploaded yet. You can add it now or later.
                            </p>
                          )}
                          {canUploadIds && party ? (
                            <ActionPanel
                              action={uploadPartyDocumentAction.bind(
                                null,
                                booking.id,
                                party.id,
                              )}
                              submitLabel="Upload privately"
                              resetAfter
                            >
                              <SelectField
                                name="category"
                                label="Document"
                                options={DOCUMENT_CATEGORIES.map((c) => ({
                                  value: c.value,
                                  label: c.label,
                                }))}
                                defaultValue="AADHAAR_MASKED"
                              />
                              <TextField
                                name="idNumber"
                                label="ID number (optional)"
                                autoComplete="off"
                                hint="For Aadhaar only the last 4 digits are saved."
                              />
                              <CompressedFileField
                                name="file"
                                label="Photo or PDF (photos are compressed to WebP)"
                                preset="document"
                                required
                              />
                              <TextField
                                name="purpose"
                                label="Why it is needed"
                                defaultValue="Identity check for the wedding booking"
                                required
                              />
                            </ActionPanel>
                          ) : canUploadIds ? (
                            <p className="text-xs text-text-muted">
                              Save the {role === "BRIDE" ? "bride" : "groom"}
                              &apos;s name first, then add documents.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <p className="text-xs text-text-muted md:col-span-2">
                  Documents are stored privately, never put on PDFs, and every
                  view is recorded. Prefer masked Aadhaar copies.
                </p>
              </CardContent>
            </details>
          </Card>
        ) : null}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <SectionTitle icon={Flag} tone="green">
                Status
              </SectionTitle>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {status === "CANCELLED" && cancellation ? (
              <div className="text-sm">
                <p>
                  Cancelled{" "}
                  {booking.cancelledAt
                    ? formatIST(booking.cancelledAt, "d MMM yyyy")
                    : ""}{" "}
                  — {cancellation.reason}
                </p>
                <p>
                  Refund agreed:{" "}
                  <strong>{formatINR(cancellation.agreedRefund ?? "0")}</strong>
                  {cancellation.overridden
                    ? ` (policy gave ${formatINR(cancellation.computedRefund ?? "0")}; ${cancellation.overrideReason})`
                    : ""}
                </p>
              </div>
            ) : null}
            {holdsExpired && status === "ENQUIRY_HOLD" ? (
              <p className="text-sm text-warning">
                A hold expired and its hall was released.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {next.map((to) =>
                (
                  to === "CONFIRMED" ||
                  !["ENQUIRY_HOLD", "TENTATIVE", "QUOTATION_SENT"].includes(
                    status,
                  )
                    ? can(user, "bookings.confirm")
                    : to === "ENQUIRY_HOLD"
                      ? can(user, "holds.place")
                      : can(user, "bookings.edit")
                ) ? (
                  <ConfirmAction
                    key={to}
                    action={changeStatusAction.bind(null, booking.id)}
                    label={
                      status === "CANCELLED"
                        ? RESTORE_ACTION
                        : isStepBack(status, to)
                          ? STEP_BACK_ACTION[to]
                          : STATUS_ACTION[to]
                    }
                    title={`${status === "CANCELLED" ? RESTORE_ACTION : isStepBack(status, to) ? STEP_BACK_ACTION[to] : STATUS_ACTION[to]}?`}
                    description={
                      status === "CANCELLED"
                        ? "Use this if the booking was cancelled by mistake. It becomes Booked again and its halls are reserved again; if another booking now has the same hall and time you'll be told. Refunds already recorded stay on record."
                        : isStepBack(status, to)
                        ? to === "TENTATIVE"
                          ? "The booking goes back to booked (not confirmed) and its halls are no longer firmly booked (other bookings will only see a warning). Payments stay on record. After this it can be cancelled, or deleted once any money received is refunded (balance ₹0)."
                          : "The booking goes back to confirmed. Payments and documents stay as they are."
                        : to === "CONFIRMED"
                          ? "Every function's hall booking becomes confirmed and the current cancellation policy is attached to the booking."
                          : undefined
                    }
                    reasonName="reason"
                    reasonLabel={
                      isStepBack(status, to) ? "Why?" : "Note (optional)"
                    }
                    reasonRequired={isStepBack(status, to)}
                    triggerVariant={
                      to === "CONFIRMED" &&
                      (status === "CANCELLED" || !isStepBack(status, to))
                        ? "default"
                        : "outline"
                    }
                  >
                    <input type="hidden" name="to" value={to} />
                    {to === "CONFIRMED" &&
                    can(user, "bookings.override_conflict") ? (
                      <TextAreaField
                        name="overrideReason"
                        label="Override a clash with another confirmed booking — reason (leave empty normally)"
                        rows={2}
                      />
                    ) : null}
                  </ConfirmAction>
                ) : null,
              )}
              {canCancel && quote ? (
                <ConfirmAction
                  action={cancelBookingAction.bind(null, booking.id)}
                  label="Cancel booking"
                  title="Cancel this booking?"
                  description={
                    <div className="space-y-1">
                      <p>
                        Its halls are released. Refunds and credit notes are
                        then recorded on the Money tab.
                      </p>
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
                  <TextField
                    name="agreedRefund"
                    label="Refund to give (₹)"
                    defaultValue={quote.refundAmount.toFixed(2)}
                    inputMode="decimal"
                  />
                  <TextAreaField
                    name="overrideReason"
                    label="If different from the policy: why?"
                    rows={2}
                  />
                </ConfirmAction>
              ) : null}
            </div>
            {booking.statusHistory.length ? (
              <ul className="space-y-1 border-t border-border pt-3 text-xs text-text-muted">
                {booking.statusHistory.slice(0, 6).map((h) => (
                  <li key={h.id}>
                    {formatIST(h.createdAt, "d MMM, h:mm a")}:{" "}
                    {h.fromStatus
                      ? `${STATUS_NAME[h.fromStatus] ?? h.fromStatus} → `
                      : ""}
                    {STATUS_NAME[h.toStatus] ?? h.toStatus}
                    {h.reason ? ` — ${h.reason}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <SectionTitle icon={ClipboardList} tone="amber">
                Booking details
              </SectionTitle>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="mb-4 grid gap-3 text-sm">
              <Detail label="Customer">
                {booking.customer
                  ? `${booking.customer.fullName} · ${formatPhoneForDisplay(booking.customer.mobile)}`
                  : "—"}
              </Detail>
              <Detail label="Event type">
                {labelOf(eventTypes, booking.mainEventTypeKey)}
              </Detail>
              <Detail label="Expected guests">
                {booking.expectedGuests ?? "—"}
              </Detail>
              {can(user, "payments.read") ? (
                <Detail label="Booking amount">
                  {booking.bookingAmount
                    ? formatINR(booking.bookingAmount)
                    : "—"}
                </Detail>
              ) : null}
              {booking.lead ? (
                <Detail label="From enquiry">{booking.lead.reference}</Detail>
              ) : null}
              {booking.notes ? (
                <Detail label="Notes">{booking.notes}</Detail>
              ) : null}
              {booking.internalInstructions && can(user, "bookings.edit") ? (
                <Detail label="Internal instructions">
                  {booking.internalInstructions}
                </Detail>
              ) : null}
            </dl>
            {editable ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  Edit details
                </summary>
                <div className="mt-4">
                  <ActionPanel
                    action={updateBookingAction.bind(null, booking.id)}
                    submitLabel="Save details"
                  >
                    <TextField
                      name="mainEventName"
                      label="Event name"
                      defaultValue={booking.mainEventName}
                    />
                    <SelectField
                      name="mainEventTypeKey"
                      label="Event type"
                      options={eventTypes}
                      defaultValue={booking.mainEventTypeKey}
                    />
                    <TextField
                      name="expectedGuests"
                      label="Expected guests"
                      type="number"
                      min={1}
                      defaultValue={booking.expectedGuests?.toString() ?? ""}
                    />
                    <TextField
                      name="bookingAmount"
                      label="Booking amount (₹)"
                      inputMode="decimal"
                      defaultValue={booking.bookingAmount?.toFixed(2) ?? ""}
                    />
                    <TextField
                      name="bookedOn"
                      label="Booking date (the day it was booked)"
                      type="date"
                      defaultValue={
                        booking.bookedOn
                          ? dateKey(booking.bookedOn)
                          : formatIST(booking.createdAt, "yyyy-MM-dd")
                      }
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <TextField
                        name="eventFrom"
                        label="Event from"
                        type="date"
                        defaultValue={
                          booking.startDate ? dateKey(booking.startDate) : ""
                        }
                      />
                      <TextField
                        name="eventTo"
                        label="Event to"
                        type="date"
                        defaultValue={
                          booking.endDate ? dateKey(booking.endDate) : ""
                        }
                        hint="Leave empty for one day."
                      />
                    </div>
                    <TextAreaField
                      name="notes"
                      label="Notes"
                      rows={2}
                      defaultValue={booking.notes ?? ""}
                    />
                    <TextAreaField
                      name="internalInstructions"
                      label="Internal instructions"
                      rows={2}
                      defaultValue={booking.internalInstructions ?? ""}
                    />
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
