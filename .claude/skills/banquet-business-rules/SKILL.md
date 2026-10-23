---
name: banquet-business-rules
description: Use when working on halls, slots, tentative holds, bookings, sub-events, availability, conflict detection, the calendar, menus, per-plate pricing, guest counts or quotation versions in The Sundaram Palace CRM.
---

# Banquet business rules

## Core model
- A **Booking** belongs to one Customer and has 1..n **SubEvents** (haldi, mehendi, sangeet, wedding, reception…).
- Each SubEvent reserves one Hall for one time range via a **SlotReservation** with state: `HOLD`, `TENTATIVE`, `CONFIRMED`, `RELEASED`, `CANCELLED`.
- A Hall has slot definitions (Morning, Evening, Full day, custom) from Settings, plus `setupBufferMinutes` and `teardownBufferMinutes`.
- Halls can be marked combinable (e.g. Hall A + Hall B = Grand Hall); booking the combined space blocks both.

## Time handling
- Store `startsAt` / `endsAt` as UTC timestamps; interpret and display in `Asia/Kolkata`.
- Slots may cross midnight (e.g. 18:00 → 01:00 next day). Build the range from the date + slot times, adding a day when end < start.
- Never compare dates as strings.

## Conflict rule
Effective range = [startsAt − setupBuffer, endsAt + teardownBuffer].
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
- A second hold on the same slot becomes a waitlist entry with a position; promote on release and notify staff.
- Holds and tentatives never count toward revenue or "confirmed" dashboards.

## Booking statuses
Enquiry Hold → Tentative → Quotation Sent → Confirmed → In Progress → Completed; or Cancelled. Statuses are configurable labels on top of these internal states; keep the internal state machine strict and validate transitions server-side.

## Menus and plates
- Menu categories: Veg, Jain, Non-veg (if offered), custom. Items grouped by course.
- MenuPackage: per-plate rate + selection rules (e.g. choose 3 of these starters).
- Each SubEvent picks a menu; the selection (items + rate) is **snapshotted** on the booking.
- Plates line item: quantity = guaranteed plates, unitPrice = per-plate rate.
- Enforce minimum guaranteed plates (Settings by package/hall/slot).
- Guest-count lock date = event date − N days (Settings). After lock, changing plates needs Manager permission and is logged.
- After the event, record actual plates served. Extra plates = max(0, actual − guaranteed) billed as a new line item at the configured rate. No refund for shortfall unless policy says so.

## Pricing rules
- Season/weekend/high-demand-date rules adjust default prices when a quotation is created. They never change existing bookings, quotation versions or invoices.

## Quotation versions
- Each version is an immutable snapshot (line items, menus, terms, totals, tax).
- Editing creates a new version; show a diff vs the previous one.
- Exactly one version can be Accepted; booking pricing follows it. Record who accepted and when.

## Sub-event rules
- The main booking date is not the date of every sub-event; check availability per sub-event.
- Reordering is cosmetic (sortOrder). Deleting a sub-event with payments allocated to it requires reallocation first.

## Tests to keep green
- Midnight-crossing slot overlap, buffer overlap, combined halls, concurrent confirm, hold expiry and waitlist promotion, minimum plates, extra-plate billing, immutable quotation versions.
