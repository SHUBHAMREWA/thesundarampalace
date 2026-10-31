import type { FoodMenu, MenuSection } from "@/lib/menu/food-menu";

import { esc } from "./html";

/**
 * The food menu as printable A4 pages (full bleed): a rate-list cover, then
 * one page per section, on the backgrounds of the caterer's own menu design.
 * The admin preview and the PDF use this same HTML.
 */
export type FoodMenuAssets = {
  tokensCss: string;
  fontsCss: string;
  /** data: URIs of the design's background images. */
  coverBg: string;
  pageTop: string;
  pageBottom: string;
};

/** Page styles, scoped to .fm so the CRM page editor can reuse them. Fonts come from --fm-sans / --fm-serif. */
export const FOOD_MENU_PAGE_CSS = `.fm { --fm-sans: "PdfInter", sans-serif; --fm-serif: "PdfCormorant", serif; font-family: var(--fm-sans); color: var(--color-menu-ink); }
.fm *, .fm *::before, .fm *::after { box-sizing: border-box; }
.fm .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; margin: 0 auto; background: var(--color-surface); break-after: page; }
.fm .page:last-child { break-after: auto; }
.fm .bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0; }
.fm .top { position: absolute; top: 0; left: 0; width: 100%; z-index: 0; }
.fm .bottom { position: absolute; bottom: 0; left: 0; width: 100%; z-index: 0; }
.fm .content { position: relative; z-index: 1; }

/* Cover: rate list */
.fm .cover .content { padding: 14mm 12mm 10mm; text-align: center; }
.fm .brand { font-family: var(--fm-serif); font-weight: 600; font-size: 36pt; color: var(--color-menu-navy); line-height: 1; }
.fm .place { font-weight: 600; font-size: 13pt; color: var(--color-menu-navy); letter-spacing: 0.05em; margin-top: 1mm; }
.fm .rate-title { font-weight: 600; font-size: 17pt; margin: 9mm 0 4mm; }
.fm table.rates { width: 100%; border-collapse: separate; border-spacing: 1.2mm; font-size: 9.5pt; font-weight: 600; }
.fm table.rates th { padding: 2.2mm 1mm; color: var(--color-surface); }
.fm table.rates th.no, .fm table.rates td.no { background: var(--color-menu-navy); color: var(--color-surface); width: 9mm; }
.fm table.rates th.menu { background: var(--color-menu-navy); text-align: left; padding-left: 4mm; font-size: 11pt; }
.fm table.rates th.price { background: var(--color-menu-ink); font-size: 11pt; }
.fm table.rates td { padding: 2mm 1mm; }
.fm table.rates td.name { text-align: left; padding-left: 3mm; border-bottom: 0.3mm solid var(--color-menu-cell); }
.fm table.rates td.val { background: var(--color-menu-cell); }
.fm table.rates tr.row-heading td.name, .fm table.rates tr.row-highlight td.name { background: var(--color-menu-navy); color: var(--color-menu-gold); }
.fm .notes { text-align: left; margin-top: 5mm; font-size: 9pt; }
.fm .notes-head { display: flex; align-items: center; gap: 4mm; margin-bottom: 2mm; }
.fm .notes-label { background: var(--color-menu-navy); color: var(--color-surface); font-weight: 600; padding: 1mm 8mm 1mm 3mm; font-size: 10.5pt; }
.fm .notes ol { margin: 0; padding-left: 7mm; line-height: 1.55; }
.fm .footer { margin-top: 6mm; }
.fm .footer .b { font-weight: 600; font-size: 22pt; letter-spacing: 0.12em; color: var(--color-menu-brown); }
.fm .footer .t { font-family: var(--fm-serif); font-weight: 600; font-size: 14pt; color: var(--color-menu-brown); }
.fm .footer .c { font-weight: 600; font-size: 14pt; color: var(--color-menu-brown); margin-top: 2mm; }

/* Section pages */
.fm .section .content { padding: 62mm 26mm 30mm; text-align: center; }
.fm .section h1 { margin: 0; font-weight: 600; font-size: 20pt; color: var(--color-menu-navy); letter-spacing: 0.02em; }
.fm .section h2.sub { margin: 2mm 0 0; font-weight: 600; font-size: 17pt; color: var(--color-menu-navy); }
.fm .items { margin-top: 9mm; columns: 2; column-gap: 12mm; text-align: left; }
.fm .items.single { columns: 1; text-align: center; }
.fm .item { font-family: var(--fm-serif); font-weight: 600; text-transform: uppercase; break-inside: avoid; }
.fm .groups { margin-top: 10mm; display: grid; grid-template-columns: 1fr 1fr; gap: 0 12mm; text-align: left; }
.fm .groups h3 { margin: 0 0 4mm; font-weight: 600; font-size: 14pt; color: var(--color-menu-navy); }
`;

/** Print-only rules for the standalone document (PDF and preview). */
const DOC_CSS = `@page { size: A4; margin: 0; }

html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; background: var(--color-menu-cell); }
@media screen { body { padding: 8mm 0; } .fm .page { margin-bottom: 8mm; box-shadow: 0 2px 12px var(--color-border-strong); } }`;

function rateList(menu: FoodMenu): string {
  const r = menu.rateList;
  const cols = r.prices.length;
  const rows = r.rows
    .map((row) => {
      if (row.style === "heading")
        return `<tr class="row-heading"><td></td><td class="name" colspan="1">${esc(row.name)}</td>${"<td></td>".repeat(cols)}</tr>`;
      const values = Array.from(
        { length: cols },
        (_, i) => `<td class="val">${esc(row.values[i] ?? "")}</td>`,
      ).join("");
      return `<tr class="row-${row.style}"><td class="${row.no ? "no" : ""}">${esc(row.no)}</td><td class="name">${esc(row.name)}</td>${values}</tr>`;
    })
    .join("");
  return `<section class="page cover">
  <img class="bg" src="{{coverBg}}" alt="">
  <div class="content">
    <div class="brand">${esc(menu.businessName)}</div>
    <div class="place">${esc(menu.place)}</div>
    <div class="rate-title">${esc(r.title)}</div>
    <table class="rates"><thead><tr><th class="no">S.No</th><th class="menu">MENU</th>${r.prices.map((p) => `<th class="price">${esc(p)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
    ${
      r.notes.length
        ? `<div class="notes"><div class="notes-head"><span class="notes-label">Notes :</span><span>${esc(r.notesLabel)}</span></div><ol>${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ol></div>`
        : ""
    }
    <div class="footer"><div class="b">${esc(menu.footer.brand)}</div><div class="t">${esc(menu.footer.tagline)}</div><div class="c">${esc(menu.footer.contact)}</div></div>
  </div>
</section>`;
}

/** Item size shrinks for long lists so a section always fits on its page. */
export function itemStyle(rows: number): string {
  const lineMm = Math.min(9, 175 / Math.max(rows, 1));
  const fontPt = Math.min(12, Math.max(8.5, lineMm * 1.45));
  return `font-size:${fontPt.toFixed(1)}pt;line-height:${lineMm.toFixed(2)}mm`;
}

function sectionPage(section: MenuSection): string {
  const named = section.groups.filter((g) => g.heading || g.items.length);
  let body: string;
  if (named.length === 1 && !named[0].heading) {
    const items = named[0].items;
    const single = items.length <= 6;
    const style = itemStyle(
      single ? items.length * 1.6 : Math.ceil(items.length / 2),
    );
    body = `<div class="items${single ? " single" : ""}">${items.map((i) => `<div class="item" style="${style}">${esc(i)}</div>`).join("")}</div>`;
  } else {
    const longest = Math.max(...named.map((g) => g.items.length), 1);
    const style = itemStyle(longest + 2);
    body = `<div class="groups">${named
      .map(
        (g) =>
          `<div>${g.heading ? `<h3>${esc(g.heading)}</h3>` : ""}${g.items.map((i) => `<div class="item" style="${style}">${esc(i)}</div>`).join("")}</div>`,
      )
      .join("")}</div>`;
  }
  return `<section class="page section">
  <img class="top" src="{{pageTop}}" alt="">
  <img class="bottom" src="{{pageBottom}}" alt="">
  <div class="content">
    <h1>${esc(section.title)}</h1>
    ${section.subtitle ? `<h2 class="sub">${esc(section.subtitle)}</h2>` : ""}
    ${body}
  </div>
</section>`;
}

export function renderFoodMenuHtml(
  menu: FoodMenu,
  assets: FoodMenuAssets,
): string {
  const pages = [
    ...(menu.showRateList === false ? [] : [rateList(menu)]),
    ...menu.sections
      .filter((s) => s.title || s.groups.some((g) => g.items.length))
      .map(sectionPage),
  ]
    .join("\n")
    // Images are inserted after escaping the text (data: URIs are trusted, built on the server).
    .replaceAll("{{coverBg}}", assets.coverBg)
    .replaceAll("{{pageTop}}", assets.pageTop)
    .replaceAll("{{pageBottom}}", assets.pageBottom);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(menu.businessName)} — Food menu</title>
<style>${assets.tokensCss}
${assets.fontsCss}
${DOC_CSS}
${FOOD_MENU_PAGE_CSS}</style>
</head>
<body>
<div class="fm">
${pages}
</div>
</body>
</html>`;
}
