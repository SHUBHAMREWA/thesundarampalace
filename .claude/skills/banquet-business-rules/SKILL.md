---
name: banquet-business-rules
description: Use when working on halls, slots, tentative holds, bookings, sub-events, availability, conflict detection, the calendar, menus, per-plate pricing, guest counts or quotation versions in The Sundaram Palace CRM.
---

# Banquet business rules

## Core model
- A **Booking** belongs to one Customer and has 1..n **SubEvents** (haldi, mehendi, sangeet, wedding, reception…).
- Each SubEvent reserves one Hall for one time range via a **SlotReservation** with state: `HOLD`, `TENTATIVE`, `CONFIRMED`, `RELEASED`, `CANCELLED`.
- **No fixed slots and no buffers** (owner decision, 26 Oct 2026): staff type each function's start and end time, and the hall is occupied exactly for that time. `SlotDefinition` rows and the hall buffer columns remain in the database (all inactive / 0) for history only; the "Halls and slots" catalog tab was removed, so combined halls can no longer be edited in the CRM.
- Halls can be marked combinable (e.g. Hall A + Hall B = Grand Hall); booking the combined space blocks both.

## Time handling
- Store `startsAt` / `endsAt` as UTC timestamps; interpret and display in `Asia/Kolkata`.
- Functions may cross midnight (e.g. 18:00 → 01:00 next day). Build the range from the date + typed times, adding a day when end < start.
- Never compare dates as strings.

## Conflict rule
Effective range = [startsAt − setupBuffer, endsAt + teardownBuffer] — both buffers are 0, so it equals the function's own times.
Two reservations conflict when: same hall (or overlapping combined halls) AND effective ranges overlap (`a.start < b.end && b.start < a.end`).
- CONFIRMED vs CONFIRMED → blocking error. Only an authorized override with reason may proceed; write an audit log entry.
- Any HOLD/TENTATIVE involved → warning, shown with the other booking's reference, hall and times.
- Different, non-combined halls never conflict.

## Concurrency
- Confirming a reservation must be race-safe. Preferred: PostgreSQL exclusion constraint on `(hallId, tstzrange(effectiveStart, effectiveEnd))` where `state = 'CONFIRMED'` (via a raw SQL migration with `btree_gist`). Alternative: `SELECT … FOR UPDATE` on the hall row inside a serializable transaction.
- Write a test that fires two confirmations at once and asserts exactly one succeeds.

## Tentative holds
- Duration default from Settings (e.g. 72 hours); expiry stored as `holdExpiresAt`.
- Notify the owner before expiry (Settings: hours before).
- A scheduled job (or on-read lazy release plus a daily job) moves expired holds to `RELEASED` and logs it.
- A second hold on the same hall time becomes a waitlist entry with a position; promote on release and notify staff.
- Holds and tentatives never count toward revenue or "confirmed" dashboards.

## Booking statuses
Enquiry Hold → Tentative → Quotation Sent → Confirmed → In Progress → Completed; or Cancelled. Statuses are configurable labels on top of these internal states; keep the internal state machine strict and validate transitions server-side.

## Menus and plates
- Menu categories: Veg, Jain, Non-veg (if offered), custom. Items grouped by course.
- MenuPackage: per-plate rate + selection rules (e.g. choose 3 of these starters).
- Each SubEvent picks a menu; the selection (items + rate) is **snapshotted** on the booking.
- Plates line item: quantity = guaranteed plates, unitPrice = per-plate rate.
- Enforce minimum guaranteed plates (per menu package).
- Guest-count lock date = event date − N days (Settings). After lock, changing plates needs Manager permission and is logged.
- After the event, record actual plates served. Extra plates = max(0, actual − guaranteed) billed as a new line item at the configured rate. No refund for shortfall unless policy says so.

## Pricing
- No season/weekend/date pricing rules: removed on 26 Oct 2026 at the owner's request. Quotations use catalogue prices; staff adjust a draft line by hand when needed. The `pricing_rule` table is left unused in the database.

## Quotation versions
- Each version is an immutable snapshot (line items, menus, terms, totals, tax).
- Editing creates a new version; show a diff vs the previous one.
- Exactly one version can be Accepted; booking pricing follows it. Record who accepted and when.

## Sub-event rules
- The main booking date is not the date of every sub-event; check availability per sub-event.
- Reordering is cosmetic (sortOrder). Deleting a sub-event with payments allocated to it requires reallocation first.

## Tests to keep green
- Midnight-crossing slot overlap, buffer overlap, combined halls, concurrent confirm, hold expiry and waitlist promotion, minimum plates, extra-plate billing, immutable quotation versions.
