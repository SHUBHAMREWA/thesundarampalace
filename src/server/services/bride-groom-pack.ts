import "server-only";

import { strToU8, zipSync, type Zippable } from "fflate";

import { db } from "@/lib/db";
import { formatPhoneForDisplay } from "@/lib/contact/links";
import { safeFileName } from "@/lib/files/sniff";
import { esc } from "@/lib/pdf/html";
import { formatDateKey, formatIST } from "@/lib/time";
import { readPrivateFile } from "@/server/storage/private";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";

import { recordAudit } from "./audit";
import { bookingVisibility } from "./bookings";
import { DOCUMENT_CATEGORIES } from "./customers";
import { NotFoundError } from "./leads";

const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

const categoryLabel = (value: string) =>
  DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ?? "Document";

/**
 * One ZIP with everything about the bride and groom of a booking: a printable
 * details page (names, phones, email, notes and the list of ID documents) and,
 * for staff allowed to see them, the ID documents and photos themselves.
 * Every file read is audit-logged, like a single download.
 */
export async function brideGroomPack(
  actor: Actor,
  bookingId: string,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<{ bytes: Uint8Array; fileName: string }> {
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
        orderBy: { role: "asc" },
        include: {
          documents: {
            where: { deletedAt: null },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              category: true,
              label: true,
              idNumber: true,
              mimeType: true,
              storageKey: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
  if (!booking) throw new NotFoundError("Booking");
  if (!booking.parties.length) throw new NotFoundError("Bride and groom details");
  const withFiles = can(actor, "documents.sensitive.read");

  const files: Zippable = {};
  const sections: string[] = [];
  const missing: string[] = [];
  for (const party of booking.parties) {
    const role = party.role === "BRIDE" ? "Bride" : "Groom";
    const rows: string[] = [];
    const used = new Set<string>();
    for (const doc of party.documents) {
      const name = doc.label?.trim() || categoryLabel(doc.category);
      let file: string | null = null;
      if (withFiles) {
        const bytes = await readPrivateFile(doc.storageKey);
        if (bytes) {
          const ext = EXT[doc.mimeType] ?? "bin";
          // "Bride - Aadhaar card.webp"; a second one of the same kind gets " (2)".
          let candidate = safeFileName(`${role} - ${name}`, ext);
          for (let n = 2; used.has(candidate); n++)
            candidate = safeFileName(`${role} - ${name} (${n})`, ext);
          used.add(candidate);
          file = `${role}/${candidate}`;
          files[file] = new Uint8Array(bytes);
          await recordAudit({
            actorId: actor.id,
            action: "document.downloaded",
            entityType: "customer_document",
            entityId: doc.id,
            summary: { booking: booking.reference, role, category: doc.category, via: "bride_groom_pack" },
            ip: meta.ip,
            userAgent: meta.userAgent,
          });
        } else missing.push(`${role}: ${name}`);
      }
      rows.push(
        `<tr><td>${esc(name)}</td><td>${esc(doc.idNumber ?? "—")}</td><td>${esc(formatIST(doc.createdAt, "d MMM yyyy"))}</td><td>${file ? esc(file) : withFiles ? "not available" : "—"}</td></tr>`,
      );
    }
    const contact = [
      ["Name", party.fullName],
      ["Mobile", party.mobile ? formatPhoneForDisplay(party.mobile) : null],
      ["Other phone", party.altPhone ? formatPhoneForDisplay(party.altPhone) : null],
      ["Email", party.email],
      ["Notes", party.notes],
    ].filter((r): r is [string, string] => !!r[1]);
    sections.push(`<section>
  <h2>${role}</h2>
  <table class="kv">${contact.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
  <h3>ID documents and photos</h3>
  ${
    rows.length
      ? `<table><thead><tr><th>Document</th><th>ID number (as stored)</th><th>Added</th><th>File in this ZIP</th></tr></thead><tbody>${rows.join("")}</tbody></table>`
      : "<p>None uploaded.</p>"
  }
</section>`);
  }

  const dates = booking.startDate
    ? `${formatDateKey(booking.startDate.toISOString().slice(0, 10))}${
        booking.endDate && booking.endDate.getTime() !== booking.startDate.getTime()
          ? ` – ${formatDateKey(booking.endDate.toISOString().slice(0, 10))}`
          : ""
      }`
    : "";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bride and groom — ${esc(booking.reference)}</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 24px auto; max-width: 820px; padding: 0 16px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 28px 0 8px; border-bottom: 1px solid; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 16px 0 6px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 6px 8px; border: 1px solid; vertical-align: top; }
  table.kv th { width: 140px; }
  .muted { opacity: 0.7; font-size: 12px; }
  @media print { body { margin: 0; } section { break-inside: avoid; } }
</style>
</head>
<body>
<h1>Bride and groom details</h1>
<p>${esc(booking.reference)} · ${esc(booking.mainEventName)}${dates ? ` · ${esc(dates)}` : ""}</p>
${sections.join("\n")}
${missing.length ? `<p class="muted">Could not be read (try again later): ${esc(missing.join(", "))}</p>` : ""}
${withFiles ? "" : `<p class="muted">The ID documents themselves are not included: your role can't download them.</p>`}
<p class="muted">Confidential — The Sundaram Palace. Downloaded ${esc(formatIST(new Date()))}.</p>
</body>
</html>`;
  files["Bride and groom details.html"] = strToU8(html);

  await recordAudit({
    actorId: actor.id,
    action: "booking.bride_groom_downloaded",
    entityType: "booking",
    entityId: booking.id,
    summary: { reference: booking.reference, documents: Object.keys(files).length - 1 },
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return {
    // Photos and PDFs are already compressed: store them as they are.
    bytes: zipSync(files, { level: 0 }),
    fileName: `Bride and groom ${booking.reference}.zip`,
  };
}
