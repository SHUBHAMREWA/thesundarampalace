---
name: pdf-documents
description: Use when building or changing PDF/print documents in The Sundaram Palace CRM — quotations, confirmations, receipts, statements, GST invoices, credit notes, deposit settlements, function sheets, food menus (no prices) — or the field picker, presets, templates and the rendering service.
---

# PDF documents

## Pipeline
1. Server loads the booking with permission checks.
2. Build a typed `DocumentData` object containing **only the fields the user ticked** (plus mandatory fields for the document type).
3. Render a trusted React/HTML template from `src/lib/pdf/templates/` with escaped values. Never accept HTML from users or the CMS without sanitization.
4. Send HTML to the renderer (Playwright Chromium). If the main host can't run Chromium, call the separate PDF service over an authenticated internal endpoint (shared secret / signed request, HTTPS only).
5. Store metadata in `GeneratedDocument` (type, template, field selection, version, reference number, createdBy, hash) and the file in private storage.
6. Return via a short-lived signed URL; log the access.

## Field picker
- Field registry per document type: `{ key, label, group, sensitive, mandatory, defaultOn, requiredPermission }`.
- Sensitive fields (identity documents, internal notes, DOB) default off and require permission; UI shows a warning when ticked.
- Mandatory fields (e.g. GST invoice legal fields) are shown ticked and disabled with a tooltip explaining why.
- Presets save `{ documentType, templateId, fields[] }` per user or globally (admin).
- The preview uses the exact same template code as the PDF.

## Templates
- Elegant Royal (Rose Mahal styling: ivory page, primary-deep header band, thin gold rule), Minimal Professional, Detailed Quotation, Compact Booking Summary, Plain, for the Food Menu given to the caterer (black on white, large text, menus per sub-event, plate counts, dietary notes, no prices).
- Branding, logo, headings, footer, contact details and standard terms come from Settings.

## Print CSS essentials
```css
@page { size: A4; margin: 16mm 14mm 18mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
thead { display: table-header-group; }
tr, .keep-together { break-inside: avoid; }
.page-break { break-before: page; }
```
- Use Playwright `page.pdf({ format: 'A4', printBackground: true, displayHeaderFooter: true, footerTemplate })` for page numbers ("Page X of Y") and document reference.
- Embed fonts locally (Cormorant Garamond, Inter, Tiro Devanagari Hindi) — no network fonts at render time.
- Wait for fonts and images (`document.fonts.ready`) before printing.
- Money via the shared INR formatter; dates in Asia/Kolkata.
- Every document shows: logo, document title, unique reference, generated timestamp, page numbers.

## Quality checks (run on real-looking seed bookings)
- A 5-day wedding with 6 sub-events and 40 line items: no clipped rows, headers repeat, no blank last page.
- Hindi names render correctly.
- Unticking a field removes it from HTML, not just hides it (assert in tests by searching the rendered HTML/PDF text).
- The Food Menu (`menu`, for the customer and the partner caterer) contains no prices. There is no kitchen sheet any more.
- Snapshot-test the HTML per template; visually inspect PDFs after template changes.
