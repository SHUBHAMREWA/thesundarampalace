import "server-only";

import { db } from "@/lib/db";
import { formatPhoneForDisplay } from "@/lib/contact/links";
import { esc } from "@/lib/pdf/html";
import { formatDateKey, formatIST } from "@/lib/time";
import { documentAssets } from "@/server/documents/assets";
import { readPrivateFile } from "@/server/storage/private";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";

import { recordAudit } from "./audit";
import { bookingVisibility } from "./bookings";
import { DOCUMENT_CATEGORIES } from "./customers";
import { NotFoundError } from "./leads";

const categoryLabel = (value: string) =>
  DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ?? "Document";

type Party = {
  fullName: string;
  mobile: string | null;
  altPhone: string | null;
  email: string | null;
  notes: string | null;
};

type DocCard = { name: string; idNumber: string | null; image: string | null; note: string | null };

const CSS = `
@page { size: A4; margin: 12mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { box-sizing: border-box; }
body { margin: 0; padding: 16px; font-family: "PdfInter", "PdfTiro", sans-serif; font-size: 10pt; line-height: 1.45; color: var(--color-text); background: var(--color-surface); }
@media print { body { padding: 0; } }
.head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--color-gold); margin-bottom: 14px; }
.brand { font-family: "PdfCormorant", serif; font-size: 20pt; font-weight: 600; color: var(--color-primary-deep); }
.title { font-family: "PdfCormorant", serif; font-size: 16pt; font-weight: 600; text-align: right; }
.muted { color: var(--color-text-muted); }
.small { font-size: 8.5pt; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cols + .cols { margin-top: 12px; }
.side { border: 1px solid var(--color-border); border-radius: 8px; padding: 10px 12px; break-inside: avoid; page-break-inside: avoid; }
h2 { margin: 0 0 6px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-primary-deep); }
h3 { margin: 16px 0 8px; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); }
dl { margin: 0; display: grid; grid-template-columns: 90px 1fr; gap: 4px 8px; }
dt { color: var(--color-text-muted); }
dd { margin: 0; font-weight: 600; white-space: pre-line; word-break: break-word; }
.doc { border: 1px solid var(--color-border); border-radius: 8px; padding: 8px; break-inside: avoid; page-break-inside: avoid; }
.doc img { display: block; width: 100%; max-height: 105mm; object-fit: contain; margin-top: 6px; background: var(--color-bg); }
.doc .label { font-weight: 600; }
.empty { visibility: hidden; }
.foot { margin-top: 16px; border-top: 1px solid var(--color-border); padding-top: 6px; }
`;

function detailsBlock(role: string, party: Party | undefined): string {
  if (!party) return `<div class="side"><h2>${role}</h2><p class="muted">No details added.</p></div>`;
  const rows = [
    ["Name", party.fullName],
    ["Mobile", party.mobile ? formatPhoneForDisplay(party.mobile) : null],
    ["Other phone", party.altPhone ? formatPhoneForDisplay(party.altPhone) : null],
    ["Email", party.email],
    ["Notes", party.notes],
  ].filter((r): r is [string, string] => !!r[1]);
  return `<div class="side"><h2>${role}</h2><dl>${rows
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`)
    .join("")}</dl></div>`;
}

function docBlock(doc: DocCard | undefined): string {
  if (!doc) return `<div class="empty"></div>`;
  return `<div class="doc">
  <div class="label">${esc(doc.name)}</div>
  ${doc.idNumber ? `<div class="small muted">ID number: ${esc(doc.idNumber)}</div>` : ""}
  ${doc.image ? `<img src="${doc.image}" alt="${esc(doc.name)}">` : ""}
  ${doc.note ? `<div class="small muted">${esc(doc.note)}</div>` : ""}
</div>`;
}

/**
 * One printable A4 sheet (Print / Save as PDF) with the bride on the left and
 * the groom on the right: their details, then their ID documents and photos
 * side by side. Staff without `documents.sensitive.read` get the details and
 * the list of documents, not the images. Every image shown is audit-logged.
 */
export async function brideGroomSheet(
  actor: Actor,
  bookingId: string,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<string> {
  assertPermission(actor, "customers.read");
  const booking = await db.booking.findFirst({
    where: { AND: [{ id: bookingId }, bookingVisibility(actor)] },
    select: {
      id: true,
      reference: true,
      mainEventName: true,
      startDate: true,
      endDate: true,
      parties: {
        include: {
          documents: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            select: { id: true, category: true, label: true, idNumber: true, mimeType: true, storageKey: true },
          },
        },
      },
    },
  });
  if (!booking) throw new NotFoundError("Booking");
  if (!booking.parties.length) throw new NotFoundError("Bride and groom details");
  const withImages = can(actor, "documents.sensitive.read");

  const bride = booking.parties.find((p) => p.role === "BRIDE");
  const groom = booking.parties.find((p) => p.role === "GROOM");

  const cards = async (party: typeof bride, role: string): Promise<DocCard[]> => {
    const out: DocCard[] = [];
    for (const doc of party?.documents ?? []) {
      const name = doc.label?.trim() || categoryLabel(doc.category);
      let image: string | null = null;
      let note: string | null = null;
      if (withImages) {
        const isPdf = doc.mimeType === "application/pdf";
        const inCloud = doc.storageKey.startsWith("cloudinary:");
        if (isPdf && !inCloud) {
          note = "PDF file — open it from the customer's documents.";
        } else {
          // A smaller copy is plenty for print; Cloudinary also renders page 1 of a PDF.
          const bytes = await readPrivateFile(
            doc.storageKey,
            undefined,
            inCloud ? `${isPdf ? "pg_1," : ""}w_1000,c_limit` : undefined,
          );
          if (bytes) {
            const mime = inCloud ? "image/webp" : doc.mimeType;
            image = `data:${mime};base64,${bytes.toString("base64")}`;
            if (isPdf) note = "First page of the PDF.";
            await recordAudit({
              actorId: actor.id,
              action: "document.downloaded",
              entityType: "customer_document",
              entityId: doc.id,
              summary: { booking: booking.reference, role, category: doc.category, via: "bride_groom_sheet" },
              ip: meta.ip,
              userAgent: meta.userAgent,
            });
          } else note = "Could not be loaded — try again later.";
        }
      }
      out.push({ name, idNumber: doc.idNumber, image, note });
    }
    return out;
  };
  const brideDocs = await cards(bride, "Bride");
  const groomDocs = await cards(groom, "Groom");

  // Documents in pairs: bride's n-th on the left, groom's n-th on the right.
  const docRows: string[] = [];
  for (let i = 0; i < Math.max(brideDocs.length, groomDocs.length); i++)
    docRows.push(`<div class="cols">${docBlock(brideDocs[i])}${docBlock(groomDocs[i])}</div>`);

  const dates = booking.startDate
    ? `${formatDateKey(booking.startDate.toISOString().slice(0, 10))}${
        booking.endDate && booking.endDate.getTime() !== booking.startDate.getTime()
          ? ` – ${formatDateKey(booking.endDate.toISOString().slice(0, 10))}`
          : ""
      }`
    : "";
  const { tokensCss, fontsCss } = documentAssets();

  await recordAudit({
    actorId: actor.id,
    action: "booking.bride_groom_downloaded",
    entityType: "booking",
    entityId: booking.id,
    summary: { reference: booking.reference, documents: brideDocs.length + groomDocs.length, images: withImages },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bride and groom ${esc(booking.reference)}</title>
<style>${tokensCss}
${fontsCss}
${CSS}</style>
</head>
<body>
<div class="head">
  <div>
    <div class="brand">The Sundaram Palace</div>
    <div class="small muted">${esc(booking.reference)} · ${esc(booking.mainEventName)}${dates ? ` · ${esc(dates)}` : ""}</div>
  </div>
  <div class="title">Bride and groom details</div>
</div>
<div class="cols">${detailsBlock("Bride", bride)}${detailsBlock("Groom", groom)}</div>
${
  docRows.length
    ? `<h3>Documents and photos</h3>${docRows.join("\n")}`
    : `<h3>Documents and photos</h3><p class="muted">None uploaded.</p>`
}
${withImages ? "" : `<p class="small muted">Document images are not shown: your role can't view ID documents.</p>`}
<p class="small muted foot">Confidential — The Sundaram Palace. Printed ${esc(formatIST(new Date()))}.</p>
</body>
</html>`;
}
