import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { formatINR } from "@/lib/money";
import { DOCUMENT_TYPES, FIELDS, TEMPLATES, type DocumentTypeKey } from "@/lib/pdf/fields";
import { dateKey, formatDateKey, formatIST } from "@/lib/time";
import type { CurrentUser } from "@/server/auth/session";
import { can } from "@/server/policies/authorize";
import type { getBookingDetail } from "@/server/services/bookings";
import { listGeneratedDocuments, listPresets, pdfAvailable } from "@/server/services/documents";

import { DocumentGenerator, type GeneratorField, type GeneratorPreset, type GeneratorType } from "./document-generator";

type Booking = Awaited<ReturnType<typeof getBookingDetail>>;

export async function DocumentsTab({ booking, user, initialType, initialSource }: { booking: Booking; user: CurrentUser; initialType: string | null; initialSource: string | null }) {
  const allowedTypes = Object.values(DOCUMENT_TYPES).filter((t) => can(user, t.permission));
  if (!allowedTypes.length) return <p className="text-sm text-text-muted">Your role can&apos;t generate documents for this booking.</p>;
  const [quotations, payments, invoices, creditNotes, history] = await Promise.all([
    db.quotationVersion.findMany({ where: { bookingId: booking.id }, orderBy: { versionNumber: "desc" }, select: { id: true, versionNumber: true, status: true, grandTotal: true } }),
    can(user, "payments.read") ? db.ledgerEntry.findMany({ where: { bookingId: booking.id, type: "PAYMENT" }, orderBy: { occurredOn: "desc" }, select: { id: true, receiptNumber: true, amount: true, occurredOn: true } }) : [],
    can(user, "payments.read") ? db.invoice.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" }, select: { id: true, number: true, grandTotal: true } }) : [],
    can(user, "payments.read") ? db.creditNote.findMany({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" }, select: { id: true, number: true, grandTotal: true } }) : [],
    listGeneratedDocuments(user, booking.id),
  ]);
  const sourcesFor = (key: DocumentTypeKey) => {
    switch (DOCUMENT_TYPES[key].source) {
      case "quotation":
        return { label: "Quotation version", items: quotations.map((q) => ({ id: q.id, label: `v${q.versionNumber} · ${q.status.toLowerCase()} · ${formatINR(q.grandTotal)}` })) };
      case "receipt":
        return { label: "Payment", items: payments.map((p) => ({ id: p.id, label: `${p.receiptNumber} · ${formatDateKey(dateKey(p.occurredOn))} · ${formatINR(p.amount)}` })) };
      case "invoice":
        return { label: "Invoice", items: invoices.map((i) => ({ id: i.id, label: `${i.number} · ${formatINR(i.grandTotal)}` })) };
      case "credit_note":
        return { label: "Credit note", items: creditNotes.map((c) => ({ id: c.id, label: `${c.number} · ${formatINR(c.grandTotal)}` })) };
      default:
        return { label: null, items: [] };
    }
  };
  const types: GeneratorType[] = allowedTypes.map((t) => {
    const source = sourcesFor(t.key);
    return {
      key: t.key,
      title: t.title,
      fields: t.fields,
      defaults: t.defaults.filter((f) => !FIELDS[f].permission || can(user, FIELDS[f].permission!)),
      mandatory: t.mandatory,
      templates: TEMPLATES.filter((x) => t.templates.includes(x.key)).map((x) => ({ key: x.key, label: x.label })),
      defaultTemplate: t.defaultTemplate,
      sources: source.items,
      sourceLabel: source.label,
      note:
        t.key === "tax_invoice" || t.key === "credit_note"
          ? "GST particulars (numbers, GSTINs, SAC, tax split, place of supply, amount in words) are always printed."
          : t.key === "kitchen_sheet"
            ? "No prices are ever printed on kitchen sheets."
            : t.storePdf
              ? "A copy of every PDF is kept."
              : null,
    };
  });
  const fields: Record<string, GeneratorField> = Object.fromEntries(
    Object.values(FIELDS).map((f) => [f.key, { key: f.key, label: f.label, group: f.group, sensitive: !!f.sensitive, allowed: !f.permission || can(user, f.permission) }]),
  );
  const presetRows = (await Promise.all(types.map((t) => listPresets(user, t.key as DocumentTypeKey)))).flat();
  const presets: GeneratorPreset[] = presetRows.map((p) => ({ id: p.id, name: p.name, type: p.documentType, template: p.template, fields: p.fields as string[], shared: p.ownerId === null }));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <DocumentGenerator
            bookingId={booking.id}
            types={types}
            fields={fields}
            presets={presets}
            initialType={initialType ?? types[0].key}
            initialSource={initialSource}
            pdfAvailable={pdfAvailable()}
            canSharePresets={can(user, "documents.templates.manage")}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Generated documents</CardTitle></CardHeader>
        <CardContent>
          {history.length ? (
            <ul className="divide-y divide-border text-sm">
              {history.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{DOCUMENT_TYPES[d.documentType as DocumentTypeKey]?.title ?? d.documentType} · {d.reference}</p>
                    <p className="text-xs text-text-muted">v{d.version} · {d.template} · {formatIST(d.createdAt)} · {d.createdByName} · {(d.fields as string[]).length} fields</p>
                  </div>
                  {d.stored ? (
                    <a href={`/api/documents/${d.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Download className="size-4" aria-hidden="true" /> {d.format.toUpperCase()}
                    </a>
                  ) : (
                    <Badge variant="outline">copy removed after 7 days</Badge>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">Nothing generated yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
