---
name: india-billing-gst
description: Use when working on any money logic in The Sundaram Palace CRM — totals, discounts, GST, tax invoices, credit notes, receipts, payment ledger, payment schedules, security deposits, refunds, cancellation slabs, number sequences or INR formatting.
---

# India billing, GST and payments

All tax rates, SAC codes and policies come from Settings and must be confirmed by the business's accountant before official use. Never hardcode them.

## Money basics
- Prisma `Decimal` (`@db.Decimal(12, 2)`) in the database; `decimal.js` (or Prisma.Decimal) in code. **No JS number arithmetic for money.**
- Round each tax component to 2 decimals using ROUND_HALF_UP; compute line totals before summing; store the rounding difference explicitly if an invoice-level round-off to the nearest rupee is enabled.
- All totals are computed in `src/lib/money/` and `src/server/services/`, never in React components. Re-validate on the server any total the client sends.

## INR formatting
- `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` → ₹1,25,000.00.
- Amount in words with Indian numbering (thousand, lakh, crore) for invoices and receipts, e.g. "Rupees One Lakh Twenty-Five Thousand Only".

## GST
- Business: legal name, GSTIN, state code (Settings). Customer: GSTIN optional, place of supply (state).
- Intra-state (business state = place of supply): CGST = SGST = rate/2. Inter-state: IGST = full rate.
- Each line item has a SAC code and tax rate from its service category in Settings.
- Support tax-exclusive (tax added on top) and tax-inclusive (back-calculate taxable value = gross / (1 + rate)).
- Discounts reduce the taxable value of the line (or are distributed pro rata if booking-level) before tax.
- Tax invoice must show: invoice number and date, supplier details and GSTIN, recipient details (and GSTIN if any), place of supply, SAC, description, quantity, taxable value, rate, tax amounts per component, total, amount in words. These fields cannot be unticked in the PDF field picker.

## Number sequences
- Table `NumberSequence(type, financialYear, prefix, next)`; financial year runs 1 April – 31 March in Asia/Kolkata (FY label e.g. `2026-27`).
- Allocate numbers inside the same transaction that creates the document, using `UPDATE … RETURNING` / row lock so numbers are sequential with no gaps or duplicates under concurrency.
- Issued invoices are immutable. Corrections → Credit Note (its own sequence) referencing the original invoice.

## Payment ledger
- Entries: PAYMENT, REFUND, ADJUSTMENT (with reason), each with amount, date (Asia/Kolkata), method (Cash, UPI, Bank Transfer, Card offline, Cheque, Other), reference, recordedBy, idempotencyKey (unique).
- Never update or delete a posted entry. Reverse with an ADJUSTMENT and log it.
- Outstanding = accepted quotation total (incl. tax) + post-event charges − (payments − refunds). Deposits are excluded.
- Payment schedule: instalments with due dates (e.g. advance % from Settings at confirmation). Reminder jobs read the schedule.
- Receipts are generated per payment and are not tax invoices.

## Security deposit
- Separate ledger: DEPOSIT_RECEIVED, DEDUCTION (reason, amount), DEPOSIT_REFUNDED.
- Not revenue unless deducted; deductions may need tax treatment per Settings/accountant.
- Settlement PDF lists received, deductions with reasons, refunded amount.

## Cancellation
- Policy = list of slabs `{ daysBeforeEventMin, refundPercent }` snapshotted onto the booking at confirmation.
- On cancel: compute refundable amount from net payments using the snapshotted slab; authorized override with reason allowed; post REFUND entries; issue a credit note if an invoice exists; release reservations.

## Never
- Store card numbers, CVV, UPI PIN or bank passwords.
- Claim online payments work before a gateway is integrated and tested.
- Count holds, tentatives or deposits as revenue.

## Tests to keep green
- Multi-instalment balance, refund + adjustment, deposit not in revenue, CGST/SGST vs IGST, inclusive vs exclusive, discount before tax, rounding, amount in words (lakh/crore), FY rollover on 1 April, concurrent invoice numbering, credit note flow, cancellation slab refund.
