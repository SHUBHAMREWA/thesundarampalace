import type { FieldKey } from "./fields";
import type { DocLine, DocTotals, DocumentData } from "./types";

/**
 * Trusted, server-side HTML templates for documents (pdf-documents skill).
 * Every dynamic value goes through esc(); no user or CMS HTML is ever
 * inserted. The same HTML is shown in the preview and sent to the PDF
 * renderer, so they cannot drift apart.
 */

export function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escaped multi-line text: blank lines become paragraphs, single newlines <br>. */
function textBlock(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${p.split("\n").map(esc).join("<br>")}</p>`)
    .join("");
}

export type DocumentAssets = {
  /** `:root { --color-…: … }` from globals.css (design tokens). */
  tokensCss: string;
  /** @font-face rules with embedded (data:) fonts. */
  fontsCss: string;
};

const BASE_CSS = `
@page { size: A4; margin: 16mm 14mm 18mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "PdfInter", "PdfTiro", sans-serif; font-size: 10pt; line-height: 1.45; color: var(--color-text); background: var(--color-surface); }
:lang(hi), .hi { font-family: "PdfTiro", "PdfInter", serif; }
h1, h2, h3 { margin: 0; font-weight: 600; }
h1 { font-family: "PdfCormorant", "PdfTiro", serif; font-size: 22pt; font-weight: 600; line-height: 1.1; }
h2 { font-size: 11pt; margin: 18px 0 6px; color: var(--color-primary-deep); text-transform: uppercase; letter-spacing: 0.06em; }
h3 { font-size: 10pt; margin: 10px 0 4px; }
p { margin: 0 0 6px; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr, .keep-together { break-inside: avoid; page-break-inside: avoid; }
th { text-align: left; font-weight: 600; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); border-bottom: 1px solid var(--color-border-strong); padding: 6px 6px; }
td { padding: 6px; border-bottom: 1px solid var(--color-border); vertical-align: top; }
.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.muted { color: var(--color-text-muted); }
.small { font-size: 8.5pt; }
.header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding-bottom: 12px; }
.brand-name { font-family: "PdfCormorant", serif; font-size: 20pt; font-weight: 600; }
.doc-meta { text-align: right; }
.doc-title { font-family: "PdfCormorant", serif; font-size: 18pt; font-weight: 600; }
.rule { height: 1px; background: var(--color-gold); margin: 4px 0 14px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.box { border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 12px; }
.label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); margin-bottom: 2px; }
.totals { margin-left: auto; width: 55%; margin-top: 8px; }
.totals td { border: 0; padding: 3px 6px; }
.totals tr.grand td { border-top: 1px solid var(--color-border-strong); font-weight: 600; font-size: 11pt; padding-top: 6px; }
.words { margin-top: 6px; font-style: italic; }
.menu-course { margin: 2px 0; }
.menu-course strong { font-weight: 600; }
.function { border: 1px solid var(--color-border); border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
.function-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 600; }
.draft-mark { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 72pt; font-weight: 600; color: var(--color-border); transform: rotate(-24deg); z-index: -1; }
.footer-text { margin-top: 18px; border-top: 1px solid var(--color-border); padding-top: 8px; }
.legal { font-size: 8.5pt; }

/* Elegant Royal: ivory page, deep band, gold rule */
body.tpl-elegant { background: var(--color-bg); }
.tpl-elegant .header { background: var(--color-primary-deep); color: var(--color-surface); padding: 16px 18px; border-radius: 8px; }
.tpl-elegant .header .muted { color: var(--color-blush); }
.tpl-elegant h2 { color: var(--color-primary); }
.tpl-elegant .box { background: var(--color-surface); }

/* Minimal Professional */
.tpl-minimal .header { border-bottom: 2px solid var(--color-text); }
.tpl-minimal .rule { display: none; }
.tpl-minimal h2 { color: var(--color-text); }

/* Detailed Quotation: same as minimal with every tax column */
.tpl-detailed .header { border-bottom: 2px solid var(--color-primary); }

/* Compact Booking Summary */
body.tpl-compact { font-size: 9pt; }
.tpl-compact h2 { margin-top: 12px; }
.tpl-compact td, .tpl-compact th { padding: 4px; }

/* Kitchen Sheet: high contrast, large text, no colour, no prices */
body.tpl-kitchen { font-size: 13pt; color: black; background: white; }
.tpl-kitchen h1, .tpl-kitchen .doc-title, .tpl-kitchen .brand-name { font-family: "PdfInter", sans-serif; }
.tpl-kitchen h2 { color: black; font-size: 13pt; }
.tpl-kitchen .muted { color: black; }
.tpl-kitchen .function { border: 2px solid black; }
.tpl-kitchen .rule { background: black; }
.tpl-kitchen .menu-course { font-size: 13pt; }
`;

function has(data: DocumentData, key: FieldKey) {
  return data.fields.includes(key);
}

function header(data: DocumentData): string {
  const b = data.business;
  return `
  <div class="header">
    <div>
      <div class="brand-name">${esc(b.displayName)}</div>
      ${b.tagline ? `<div class="muted small">${esc(b.tagline)}</div>` : ""}
      ${b.address ? `<div class="muted small">${esc(b.address)}</div>` : ""}
      <div class="muted small">${[b.phone, b.email].filter(Boolean).map(esc).join(" · ")}</div>
      ${b.gstin ? `<div class="muted small">GSTIN ${esc(b.gstin)}</div>` : ""}
    </div>
    <div class="doc-meta">
      <div class="doc-title">${esc(data.title)}</div>
      <div><strong>${esc(data.reference)}</strong></div>
      ${data.reference !== data.bookingReference ? `<div class="muted small">Booking ${esc(data.bookingReference)}</div>` : ""}
      <div class="muted small">Generated ${esc(data.generatedAt)} IST</div>
    </div>
  </div>
  <div class="rule"></div>`;
}

function customerBlock(data: DocumentData): string {
  const c = data.customer;
  if (!c) return "";
  const rows = [
    c.name ? `<div><strong>${esc(c.name)}</strong></div>` : "",
    c.company ? `<div>${esc(c.company)}</div>` : "",
    c.mobile ? `<div>${esc(c.mobile)}</div>` : "",
    c.email ? `<div>${esc(c.email)}</div>` : "",
    c.address ? `<div>${esc(c.address)}</div>` : "",
    c.gstin ? `<div>GSTIN ${esc(c.gstin)}</div>` : "",
  ].join("");
  return rows ? `<div class="box"><div class="label">Customer</div>${rows}</div>` : "";
}

function eventBlock(data: DocumentData): string {
  const e = data.event;
  if (!e) return "";
  return `<div class="box"><div class="label">Event</div><div><strong>${esc(e.name)}</strong></div><div>${esc(e.type)}</div><div>${esc(e.dates)}</div>${e.guests ? `<div>${esc(e.guests)} guests expected</div>` : ""}</div>`;
}

function functionsBlock(data: DocumentData): string {
  if (!data.functions?.length) return "";
  const showGuests = has(data, "event.guests");
  const showMenu = has(data, "menu.items");
  const showSpecial = has(data, "notes.special");
  return `<h2>Functions</h2>${data.functions
    .map(
      (f) => `
    <div class="function keep-together">
      <div class="function-head"><span>${esc(f.name)}</span><span>${esc(f.date)} · ${esc(f.time)}</span></div>
      <div>${esc(f.hall)}${f.slot ? ` · ${esc(f.slot)}` : ""}</div>
      ${showGuests && (f.guests || f.plates) ? `<div>${f.guests ? `${esc(f.guests)} guests` : ""}${f.guests && f.plates ? " · " : ""}${f.plates ? `<strong>${esc(f.plates)} plates guaranteed</strong>` : ""}</div>` : ""}
      ${showMenu && f.menuName ? `<h3>${esc(f.menuName)}</h3>${f.menu.map((c) => `<div class="menu-course"><strong>${esc(c.course)}:</strong> ${c.items.map(esc).join(", ")}</div>`).join("")}` : ""}
      ${showMenu && f.dietaryNotes ? `<div><strong>Dietary notes:</strong> ${esc(f.dietaryNotes)}</div>` : ""}
      ${showSpecial && f.instructions ? `<div><strong>Instructions:</strong> ${esc(f.instructions)}</div>` : ""}
    </div>`,
    )
    .join("")}`;
}

function hallsBlock(data: DocumentData): string {
  if (!data.halls?.length) return "";
  return `<h2>Venue</h2>${data.halls.map((h) => `<div class="keep-together"><strong>${esc(h.name)}</strong>${h.details.length ? ` — <span class="muted">${h.details.map(esc).join(" · ")}</span>` : ""}</div>`).join("")}`;
}

function partiesBlock(data: DocumentData): string {
  if (!data.parties?.length) return "";
  return `<h2>Bride and groom</h2><div class="grid2">${data.parties
    .map((p) => `<div class="box"><div class="label">${esc(p.label)}</div><div><strong>${esc(p.name)}</strong></div>${[p.mobile, p.altPhone, p.email].filter(Boolean).map((v) => `<div>${esc(v)}</div>`).join("")}</div>`)
    .join("")}</div>`;
}

function linesTable(lines: DocLine[], opts: { detailed: boolean; showDiscount: boolean; showTax: boolean; supplyType: "INTRA" | "INTER"; showSac: boolean }): string {
  const taxCols = opts.showTax ? (opts.supplyType === "INTRA" ? ["CGST", "SGST"] : ["IGST"]) : [];
  return `<table>
    <thead><tr>
      <th>#</th><th>Description</th>${opts.showSac ? "<th>SAC</th>" : ""}<th class="num">Qty</th><th class="num">Rate</th>
      ${opts.showDiscount ? '<th class="num">Discount</th>' : ""}
      ${opts.showTax ? '<th class="num">Taxable</th><th class="num">GST %</th>' + taxCols.map((c) => `<th class="num">${c}</th>`).join("") : ""}
      <th class="num">Amount</th>
    </tr></thead>
    <tbody>${lines
      .map(
        (l, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(l.description)}${l.functionLabel ? `<div class="muted small">${esc(l.functionLabel)}</div>` : ""}</td>
        ${opts.showSac ? `<td>${esc(l.sac)}</td>` : ""}
        <td class="num">${esc(l.quantity)} ${esc(l.unit)}</td>
        <td class="num">${esc(l.rate)}</td>
        ${opts.showDiscount ? `<td class="num">${esc(l.discount ?? "—")}</td>` : ""}
        ${opts.showTax ? `<td class="num">${esc(l.taxable)}</td><td class="num">${esc(l.taxRate)}</td>${opts.supplyType === "INTRA" ? `<td class="num">${esc(l.cgst)}</td><td class="num">${esc(l.sgst)}</td>` : `<td class="num">${esc(l.igst)}</td>`}` : ""}
        <td class="num">${esc(l.total)}</td>
      </tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

function totalsTable(t: DocTotals, opts: { showDiscount: boolean; showTax: boolean; supplyType: "INTRA" | "INTER" }): string {
  const rows: [string, string][] = [];
  if (t.subtotal) rows.push(["Subtotal", t.subtotal]);
  if (opts.showDiscount && t.discount) rows.push(["Discount", `− ${t.discount}`]);
  if (opts.showTax) {
    rows.push(["Taxable value", t.taxable]);
    if (opts.supplyType === "INTRA") {
      rows.push(["CGST", t.cgst], ["SGST", t.sgst]);
    } else rows.push(["IGST", t.igst]);
  }
  if (t.roundOff) rows.push(["Round-off", t.roundOff]);
  return `<table class="totals keep-together"><tbody>
    ${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${esc(v)}</td></tr>`).join("")}
    <tr class="grand"><td>Total${opts.showTax ? " (incl. GST)" : ""}</td><td class="num">${esc(t.grandTotal)}</td></tr>
  </tbody></table>
  <div class="words small">${esc(t.inWords)}</div>`;
}

function quotationBlock(data: DocumentData): string {
  const q = data.quotation;
  if (!q) return "";
  const parts: string[] = [];
  parts.push(`<div class="muted small">Version ${esc(q.version)}${q.validUntil ? ` · valid until ${esc(q.validUntil)}` : ""} · prices ${q.pricesIncludeTax ? "include" : "exclude"} GST · place of supply ${esc(q.placeOfSupply)}</div>`);
  if (q.lines) {
    parts.push(`<h2>Charges</h2>`);
    parts.push(linesTable(q.lines, { detailed: data.template === "detailed", showDiscount: q.showDiscount, showTax: q.showTax && data.template === "detailed", supplyType: q.supplyType, showSac: data.template === "detailed" }));
  }
  if (has(data, "pricing.total")) {
    parts.push(totalsTable(q.totals, { showDiscount: q.showDiscount, showTax: q.showTax, supplyType: q.supplyType }));
  }
  return parts.join("");
}

function paymentsBlock(data: DocumentData): string {
  const p = data.payments;
  if (!p) return "";
  const parts: string[] = [];
  if (p.received) {
    parts.push(`<h2>Payments</h2>`);
    parts.push(
      p.received.length
        ? `<table><thead><tr><th>Date</th><th>Details</th><th>Method</th><th class="num">Amount</th></tr></thead><tbody>${p.received
            .map((r) => `<tr><td>${esc(r.date)}</td><td>${esc(r.label)}</td><td>${esc(r.method)}</td><td class="num">${r.direction === "OUT" ? "− " : ""}${esc(r.amount)}</td></tr>`)
            .join("")}</tbody></table>`
        : `<p class="muted">No payments recorded yet.</p>`,
    );
  }
  const summary: [string, string][] = [];
  if (p.agreed) summary.push(["Agreed total", p.agreed]);
  if (p.netReceived) summary.push(["Received (net)", p.netReceived]);
  if (p.balance) summary.push(["Balance due", p.balance]);
  if (summary.length) {
    parts.push(`<table class="totals keep-together"><tbody>${summary.map(([k, v], i) => `<tr${i === summary.length - 1 ? ' class="grand"' : ""}><td>${esc(k)}</td><td class="num">${esc(v)}</td></tr>`).join("")}</tbody></table>`);
  }
  if (p.schedule?.length) {
    parts.push(`<h2>Payment schedule</h2><table><thead><tr><th>Instalment</th><th>Due on</th><th class="num">Amount</th><th class="num">Paid</th><th>Status</th></tr></thead><tbody>${p.schedule
      .map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(s.dueOn)}</td><td class="num">${esc(s.amount)}</td><td class="num">${esc(s.paid)}</td><td>${esc(s.status)}</td></tr>`)
      .join("")}</tbody></table>`);
  }
  return parts.join("");
}

function depositBlock(data: DocumentData): string {
  const d = data.deposit;
  if (!d) return "";
  return `<h2>Security deposit</h2>
  ${d.entries.length ? `<table><thead><tr><th>Date</th><th>Entry</th><th>Reason</th><th class="num">Amount</th></tr></thead><tbody>${d.entries.map((e) => `<tr><td>${esc(e.date)}</td><td>${esc(e.type)}</td><td>${esc(e.reason ?? "")}</td><td class="num">${esc(e.amount)}</td></tr>`).join("")}</tbody></table>` : '<p class="muted">No deposit recorded.</p>'}
  <table class="totals keep-together"><tbody>
    <tr><td>Received</td><td class="num">${esc(d.received)}</td></tr>
    <tr><td>Deductions</td><td class="num">− ${esc(d.deducted)}</td></tr>
    <tr><td>Refunded</td><td class="num">− ${esc(d.refunded)}</td></tr>
    <tr class="grand"><td>Still held</td><td class="num">${esc(d.held)}</td></tr>
  </tbody></table>
  <p class="small muted">The security deposit is refundable and is not part of the booking amount.</p>`;
}

function receiptBlock(data: DocumentData): string {
  const r = data.receipt;
  if (!r) return "";
  return `<div class="box keep-together" style="margin-top:12px">
    <div class="label">Received with thanks</div>
    <div style="font-size:16pt;font-weight:600">${esc(r.amount)}</div>
    <div class="words">${esc(r.inWords)}</div>
    <div>On ${esc(r.date)} by ${esc(r.method)}${r.transactionRef ? ` (ref. ${esc(r.transactionRef)})` : ""}</div>
    ${r.balanceAfter ? `<div>Balance due on the booking: <strong>${esc(r.balanceAfter)}</strong></div>` : ""}
  </div>
  <p class="small muted" style="margin-top:8px">This is a payment receipt, not a tax invoice.</p>`;
}

function partyBox(label: string, p: { legalName?: string; name?: string; company?: string | null; gstin: string | null; address: string | null; state: string; phone?: string | null; email?: string | null }) {
  return `<div class="box"><div class="label">${esc(label)}</div>
    <div><strong>${esc(p.legalName ?? p.name ?? "")}</strong></div>
    ${p.company ? `<div>${esc(p.company)}</div>` : ""}
    ${p.address ? `<div>${esc(p.address)}</div>` : ""}
    <div>State: ${esc(p.state)}</div>
    <div>GSTIN: ${esc(p.gstin ?? "Unregistered")}</div>
    ${p.phone ? `<div>${esc(p.phone)}</div>` : ""}
    ${p.email ? `<div>${esc(p.email)}</div>` : ""}
  </div>`;
}

function invoiceBlock(data: DocumentData): string {
  const inv = data.invoice;
  if (!inv) return "";
  return `
  <div class="grid2 legal">
    <div><strong>Invoice no.</strong> ${esc(inv.number)}<br><strong>Invoice date</strong> ${esc(inv.date)}</div>
    <div><strong>Place of supply</strong> ${esc(inv.placeOfSupply)}<br><strong>Supply</strong> ${inv.supplyType === "INTRA" ? "Intra-state (CGST + SGST)" : "Inter-state (IGST)"}${inv.status !== "ISSUED" ? `<br><strong>Status</strong> ${esc(inv.status)}` : ""}</div>
  </div>
  <div class="grid2" style="margin-top:10px">${partyBox("Supplier", inv.supplier)}${partyBox("Recipient", inv.recipient)}</div>
  <h2>Particulars</h2>
  ${linesTable(inv.lines, { detailed: true, showDiscount: inv.lines.some((l) => l.discount), showTax: true, supplyType: inv.supplyType, showSac: true })}
  ${totalsTable(inv.totals, { showDiscount: false, showTax: true, supplyType: inv.supplyType })}
  ${inv.notes ? `<div class="small" style="margin-top:8px">${textBlock(inv.notes)}</div>` : ""}
  <p class="small muted">Tax rates and SAC codes as configured by the business and confirmed by its accountant.</p>`;
}

function creditNoteBlock(data: DocumentData): string {
  const cn = data.creditNote;
  if (!cn) return "";
  return `
  <div class="grid2 legal">
    <div><strong>Credit note no.</strong> ${esc(cn.number)}<br><strong>Date</strong> ${esc(cn.date)}</div>
    <div><strong>Against invoice</strong> ${esc(cn.invoiceNumber)} dated ${esc(cn.invoiceDate)}<br><strong>Reason</strong> ${esc(cn.reason)}</div>
  </div>
  <div class="grid2" style="margin-top:10px">${partyBox("Supplier", cn.supplier)}${partyBox("Recipient", cn.recipient)}</div>
  <h2>Credited</h2>
  ${linesTable(cn.lines, { detailed: true, showDiscount: false, showTax: true, supplyType: cn.supplyType, showSac: true })}
  ${totalsTable(cn.totals, { showDiscount: false, showTax: true, supplyType: cn.supplyType })}`;
}

function termsBlock(data: DocumentData): string {
  const t = data.terms;
  if (!t) return "";
  const sections: [string, string | null | undefined][] = [
    ["Payment terms", t.payment],
    ["Cancellation policy", t.cancellation],
    ["Booking conditions", t.conditions],
    ["Bank details", t.bank],
  ];
  return sections
    .filter(([, v]) => v !== undefined)
    .map(([title, v]) => `<div class="keep-together"><h2>${esc(title)}</h2>${v ? textBlock(v) : '<p class="muted">To be confirmed.</p>'}</div>`)
    .join("");
}

function notesBlock(data: DocumentData): string {
  const n = data.notes;
  if (!n) return "";
  const parts: string[] = [];
  if (n.custom) parts.push(`<div class="keep-together"><h2>Notes</h2>${textBlock(n.custom)}</div>`);
  if (n.special?.length) parts.push(`<div class="keep-together"><h2>Special instructions</h2>${n.special.map((s) => `<p>${esc(s)}</p>`).join("")}</div>`);
  if (n.internal) parts.push(`<div class="keep-together box"><div class="label">Internal — staff only</div>${textBlock(n.internal)}</div>`);
  return parts.join("");
}

/** Full standalone HTML document (fonts embedded; no external requests). */
export function renderDocumentHtml(data: DocumentData, assets: DocumentAssets): string {
  const topBlocks =
    data.customer || data.event ? `<div class="grid2">${customerBlock(data)}${eventBlock(data)}</div>` : "";
  const body = [
    data.draft ? `<div class="draft-mark">DRAFT</div>` : "",
    header(data),
    data.type === "tax_invoice" || data.type === "credit_note" ? "" : topBlocks,
    invoiceBlock(data),
    creditNoteBlock(data),
    data.type === "tax_invoice" || data.type === "credit_note" ? topBlocks : "",
    receiptBlock(data),
    partiesBlock(data),
    data.packageName ? `<h2>Package</h2><p>${esc(data.packageName)}</p>` : "",
    functionsBlock(data),
    hallsBlock(data),
    quotationBlock(data),
    paymentsBlock(data),
    depositBlock(data),
    termsBlock(data),
    notesBlock(data),
    data.business.footer ? `<div class="footer-text small muted">${textBlock(data.business.footer)}</div>` : "",
  ].join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(data.title)} ${esc(data.reference)}</title>
<style>${assets.tokensCss}
${assets.fontsCss}
${BASE_CSS}</style>
</head>
<body class="tpl-${esc(data.template)}">
${body}
</body>
</html>`;
}
