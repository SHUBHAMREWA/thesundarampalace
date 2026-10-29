import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { DOCUMENT_TYPES, isDocumentType, resolveFields, TEMPLATES, type DocumentTypeKey, type TemplateKey } from "@/lib/pdf/fields";
import { renderDocumentHtml } from "@/lib/pdf/html";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";
import { documentAssets } from "@/server/documents/assets";
import { assertDocumentAccess, buildDocumentData, type DocumentRequest } from "@/server/documents/data";
import { renderPdf, rendererMode } from "@/server/documents/renderer";
import { putPrivateFile, readPrivateFile, sha256Hex } from "@/server/storage/private";

import { recordActivity } from "./activity";
import { recordAudit } from "./audit";
import { fieldError, RuleError } from "./errors";
import { NotFoundError } from "./leads";

/**
 * Generated documents (MASTER_PROMPT §14). The preview and the PDF use the
 * same HTML. Every generated document is recorded (who, which fields,
 * template, hash); PDFs are kept in the private store — financial documents
 * permanently, others for a week (the daily job removes the bytes).
 */

export const documentRequestSchema = z.object({
  bookingId: z.string().min(1).max(50),
  type: z.string().refine(isDocumentType, "Unknown document type"),
  template: z.string().refine((v) => TEMPLATES.some((t) => t.key === v), "Unknown template"),
  fields: z.array(z.string().max(40)).max(60),
  sourceId: z.string().max(50).nullish(),
  customNote: z.string().max(4000).nullish(),
});

export function parseDocumentRequest(input: unknown): DocumentRequest {
  const parsed = documentRequestSchema.parse(input);
  return { ...parsed, type: parsed.type as DocumentTypeKey, template: parsed.template as TemplateKey };
}

/** Request from URL search params (preview iframe). */
export function documentRequestFromSearch(params: URLSearchParams): DocumentRequest {
  return parseDocumentRequest({
    bookingId: params.get("bookingId") ?? "",
    type: params.get("type") ?? "",
    template: params.get("template") ?? "",
    fields: params.getAll("f"),
    sourceId: params.get("sourceId") || null,
    customNote: params.get("note") || null,
  });
}

export async function previewDocumentHtml(actor: Actor, request: DocumentRequest): Promise<string> {
  const { data } = await buildDocumentData(actor, request);
  return renderDocumentHtml(data, documentAssets());
}

const SENSITIVE_FIELDS = new Set(["customer.address", "party.bride", "party.groom", "notes.internal"]);

/**
 * Generates and records a document. Returns the record id; the file is
 * downloaded through /api/documents/[id] (permission-checked, audit-logged).
 */
export async function generateDocument(actor: Actor, request: DocumentRequest) {
  const { data, sourceId } = await buildDocumentData(actor, request);
  const html = renderDocumentHtml(data, documentAssets());
  const pdf = await renderPdf(html, data.reference);
  const def = DOCUMENT_TYPES[request.type];
  const bytes = pdf ?? Buffer.from(html, "utf8");
  return db.$transaction(async (tx) => {
    const previous = await tx.generatedDocument.count({ where: { bookingId: request.bookingId, documentType: request.type } });
    const stored = await putPrivateFile(bytes, pdf ? "application/pdf" : "text/html", tx);
    const doc = await tx.generatedDocument.create({
      data: {
        bookingId: request.bookingId,
        documentType: request.type,
        template: data.template,
        fields: data.fields,
        reference: data.reference,
        sourceId,
        version: previous + 1,
        format: pdf ? "pdf" : "html",
        sha256: sha256Hex(bytes),
        storageKey: stored.storageKey,
        sizeBytes: stored.sizeBytes,
        createdById: actor.id,
      },
    });
    const sensitive = data.fields.filter((f) => SENSITIVE_FIELDS.has(f));
    await recordAudit({ actorId: actor.id, action: "document.generated", entityType: "generated_document", entityId: doc.id, summary: { type: request.type, reference: data.reference, format: doc.format, sensitiveFields: sensitive, kept: def.storePdf ? "permanent" : "7 days" } }, tx);
    if (can(actor, "bookings.read")) {
      await recordActivity({ entityType: "booking", entityId: request.bookingId, actorId: actor.id, kind: "DOCUMENT", message: `${def.title} ${data.reference} generated (${doc.format.toUpperCase()})` }, tx);
    }
    return doc;
  });
}

/** Bytes of a generated document for download (and an audit entry). */
export async function readGeneratedDocument(actor: Actor, id: string, meta: { ip?: string | null; userAgent?: string | null }) {
  const doc = await db.generatedDocument.findUnique({ where: { id } });
  if (!doc || !isDocumentType(doc.documentType)) throw new NotFoundError("Document");
  await assertDocumentAccess(actor, doc.bookingId, doc.documentType);
  const bytes = doc.storageKey ? await readPrivateFile(doc.storageKey) : null;
  if (!bytes) throw new RuleError("This copy is no longer stored. Generate the document again.");
  await recordAudit({ actorId: actor.id, action: "document.downloaded", entityType: "generated_document", entityId: doc.id, summary: { type: doc.documentType, reference: doc.reference }, ip: meta.ip, userAgent: meta.userAgent });
  const safeName = `${doc.reference.replace(/[^\w.-]+/g, "_")}.${doc.format === "pdf" ? "pdf" : "html"}`;
  return { bytes, fileName: safeName, mimeType: doc.format === "pdf" ? "application/pdf" : "text/html; charset=utf-8" };
}

export async function listGeneratedDocuments(actor: Actor, bookingId: string) {
  assertPermission(actor, "bookings.read");
  const docs = await db.generatedDocument.findMany({ where: { bookingId }, orderBy: { createdAt: "desc" }, take: 100 });
  const userIds = [...new Set(docs.map((d) => d.createdById))];
  const keys = docs.map((d) => d.storageKey).filter((k): k is string => !!k);
  const [users, blobs] = await Promise.all([
    db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }),
    db.privateBlob.findMany({ where: { key: { in: keys } }, select: { key: true } }),
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const present = new Set(blobs.map((b) => b.key));
  return docs
    .filter((d) => isDocumentType(d.documentType) && can(actor, DOCUMENT_TYPES[d.documentType as DocumentTypeKey].permission))
    .map((d) => ({ ...d, createdByName: names.get(d.createdById) ?? "Staff", stored: !!d.storageKey && present.has(d.storageKey) }));
}

/** Daily: drop the bytes of non-financial PDFs older than a week (the record stays). */
export async function pruneTemporaryDocuments(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 7 * 86_400_000);
  const temporaryTypes = Object.values(DOCUMENT_TYPES).filter((d) => !d.storePdf).map((d) => d.key);
  // generated_document is append-only, so its storageKey stays; only the bytes go.
  return db.$executeRaw`
    DELETE FROM "private_blob" b
     USING "generated_document" g
     WHERE g."storageKey" = b."key"
       AND g."documentType" = ANY(${temporaryTypes})
       AND g."createdAt" < ${cutoff}`;
}

export function pdfAvailable(): boolean {
  return rendererMode() !== "none";
}

// ─── Presets ─────────────────────────────────────────────────────────────────

export const presetSchema = z.object({
  name: z.string().trim().min(1, "Name the preset").max(80),
  type: z.string().refine(isDocumentType, "Unknown document type"),
  template: z.string().refine((v) => TEMPLATES.some((t) => t.key === v), "Unknown template"),
  fields: z.array(z.string().max(40)).max(60),
  shared: z.boolean().default(false),
});

export async function listPresets(actor: Actor, type: DocumentTypeKey) {
  return db.documentPreset.findMany({
    where: { documentType: type, OR: [{ ownerId: actor.id }, { ownerId: null }] },
    orderBy: [{ ownerId: "asc" }, { name: "asc" }],
  });
}

export async function savePreset(actor: Actor, input: z.infer<typeof presetSchema>) {
  const type = input.type as DocumentTypeKey;
  assertPermission(actor, DOCUMENT_TYPES[type].permission);
  if (input.shared) assertPermission(actor, "documents.templates.manage");
  const fields = resolveFields(type, input.fields, () => true);
  if (!fields.length) fieldError("fields", "Tick at least one field");
  const preset = await db.documentPreset.create({
    data: { name: input.name, documentType: type, template: input.template, fields, ownerId: input.shared ? null : actor.id, createdById: actor.id },
  });
  await recordAudit({ actorId: actor.id, action: "document_preset.saved", entityType: "document_preset", entityId: preset.id, summary: { name: preset.name, type, shared: input.shared } });
  return preset;
}

export async function deletePreset(actor: Actor, id: string) {
  const preset = await db.documentPreset.findUnique({ where: { id } });
  if (!preset) throw new NotFoundError("Preset");
  if (preset.ownerId === null) assertPermission(actor, "documents.templates.manage");
  else if (preset.ownerId !== actor.id) throw new NotFoundError("Preset");
  await db.documentPreset.delete({ where: { id } });
}
