"use client";

import { Download, Printer, RefreshCw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { nativeSelectClass } from "@/components/forms/form-kit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deletePresetAction, generateDocumentAction, savePresetAction } from "@/server/actions/documents";

export type GeneratorField = { key: string; label: string; group: string; sensitive: boolean; allowed: boolean };
export type GeneratorType = {
  key: string;
  title: string;
  fields: string[];
  defaults: string[];
  mandatory: string[];
  templates: { key: string; label: string }[];
  defaultTemplate: string;
  sources: { id: string; label: string }[];
  sourceLabel: string | null;
  note: string | null;
};
export type GeneratorPreset = { id: string; name: string; type: string; template: string; fields: string[]; shared: boolean };

/**
 * PDF / print workflow (MASTER_PROMPT §14): type → source → template →
 * tick fields → preview → generate or print → optionally save a preset.
 * The preview is the exact HTML the PDF is made from.
 */
export function DocumentGenerator({
  bookingId,
  types,
  fields,
  presets: initialPresets,
  initialType,
  initialSource,
  pdfAvailable,
  canSharePresets,
}: {
  bookingId: string;
  types: GeneratorType[];
  fields: Record<string, GeneratorField>;
  presets: GeneratorPreset[];
  initialType: string;
  initialSource: string | null;
  pdfAvailable: boolean;
  canSharePresets: boolean;
}) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [typeKey, setTypeKey] = useState(types.some((t) => t.key === initialType) ? initialType : types[0].key);
  const type = types.find((t) => t.key === typeKey)!;
  const [template, setTemplate] = useState(type.defaultTemplate);
  const [selected, setSelected] = useState<Set<string>>(new Set(type.defaults));
  const [sourceId, setSourceId] = useState<string>(initialSource && type.sources.some((s) => s.id === initialSource) ? initialSource : (type.sources[0]?.id ?? ""));
  const [note, setNote] = useState("");
  const [presets, setPresets] = useState(initialPresets);
  const [presetName, setPresetName] = useState("");
  const [sharePreset, setSharePreset] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const chooseType = (key: string) => {
    const next = types.find((t) => t.key === key)!;
    setTypeKey(key);
    setTemplate(next.defaultTemplate);
    setSelected(new Set(next.defaults));
    setSourceId(next.sources[0]?.id ?? "");
    setError(null);
  };

  const fieldList = useMemo(() => [...new Set([...selected, ...type.mandatory])].filter((f) => type.fields.includes(f)), [selected, type]);
  const query = useMemo(() => {
    const params = new URLSearchParams({ bookingId, type: typeKey, template });
    for (const f of fieldList) params.append("f", f);
    if (sourceId) params.set("sourceId", sourceId);
    if (note.trim() && fieldList.includes("notes.custom")) params.set("note", note.trim());
    return params.toString();
  }, [bookingId, typeKey, template, fieldList, sourceId, note]);
  // The preview refreshes on demand (and whenever the type, template or source changes).
  const [previewQuery, setPreviewQuery] = useState(query);
  const [lastStructural, setLastStructural] = useState(`${typeKey}|${template}|${sourceId}`);
  if (`${typeKey}|${template}|${sourceId}` !== lastStructural) {
    setLastStructural(`${typeKey}|${template}|${sourceId}`);
    setPreviewQuery(query);
  }

  const groups = [...new Set(type.fields.map((f) => fields[f].group))];
  const typePresets = presets.filter((p) => p.type === typeKey);

  const generate = () =>
    start(async () => {
      setError(null);
      const result = await generateDocumentAction({ bookingId, type: typeKey, template, fields: fieldList, sourceId: sourceId || null, customNote: note || null });
      if (!result.ok) {
        setError(result.message ?? "Couldn't generate the document.");
        return;
      }
      toast.success(result.message ?? "Generated.");
      // A plain link click downloads the file (an API route, not a page).
      const link = document.createElement("a");
      link.href = `/api/documents/${result.data!.id}`;
      link.click();
      router.refresh();
    });

  const print = () => {
    setPreviewQuery(query);
    setTimeout(() => frame.current?.contentWindow?.print(), 600);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="doc-type">Document</Label>
          <select id="doc-type" className={nativeSelectClass} value={typeKey} onChange={(e) => chooseType(e.target.value)}>
            {types.map((t) => (
              <option key={t.key} value={t.key}>{t.title}</option>
            ))}
          </select>
          {type.note ? <p className="text-xs text-text-muted">{type.note}</p> : null}
        </div>
        {type.sourceLabel ? (
          <div className="space-y-1.5">
            <Label htmlFor="doc-source">{type.sourceLabel}</Label>
            {type.sources.length ? (
              <select id="doc-source" className={nativeSelectClass} value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
                {type.sources.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-text-muted">Nothing to print yet.</p>
            )}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="doc-template">Template</Label>
          <select id="doc-template" className={nativeSelectClass} value={template} onChange={(e) => setTemplate(e.target.value)}>
            {type.templates.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </div>
        {typePresets.length ? (
          <div className="space-y-1.5">
            <Label htmlFor="doc-preset">Presets</Label>
            <div className="flex gap-2">
              <select
                id="doc-preset"
                className={nativeSelectClass}
                defaultValue=""
                onChange={(e) => {
                  const p = typePresets.find((x) => x.id === e.target.value);
                  if (!p) return;
                  setTemplate(p.template);
                  setSelected(new Set(p.fields));
                }}
              >
                <option value="">Apply a preset…</option>
                {typePresets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.shared ? " (shared)" : ""}</option>
                ))}
              </select>
            </div>
            <ul className="space-y-1 text-xs text-text-muted">
              {typePresets.filter((p) => !p.shared || canSharePresets).map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span>{p.name}</span>
                  <button
                    type="button"
                    className="text-danger hover:underline"
                    onClick={() =>
                      start(async () => {
                        const result = await deletePresetAction(p.id);
                        if (result.ok) setPresets((all) => all.filter((x) => x.id !== p.id));
                        else toast.error(result.message ?? "Couldn't delete");
                      })
                    }
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium">Fields to include</legend>
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-1 text-xs font-semibold tracking-wide text-text-muted uppercase">{group}</p>
              <div className="space-y-1">
                {type.fields
                  .filter((f) => fields[f].group === group)
                  .map((f) => {
                    const def = fields[f];
                    const mandatory = type.mandatory.includes(f);
                    const id = `fld-${f.replace(/\W/g, "-")}`;
                    return (
                      <div key={f} className="flex items-start gap-2 text-sm">
                        <input
                          id={id}
                          type="checkbox"
                          className="mt-0.5 size-4 accent-primary"
                          checked={mandatory || selected.has(f)}
                          disabled={mandatory || !def.allowed}
                          onChange={(e) =>
                            setSelected((s) => {
                              const next = new Set(s);
                              if (e.target.checked) next.add(f);
                              else next.delete(f);
                              return next;
                            })
                          }
                        />
                        <label htmlFor={id}>
                          {def.label}
                          {mandatory ? <span className="text-text-muted"> — always included</span> : null}
                          {!def.allowed ? <span className="text-text-muted"> — needs permission</span> : null}
                          {def.sensitive && def.allowed && selected.has(f) ? <span className="block text-xs text-warning">Personal data: include only when needed.</span> : null}
                        </label>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </fieldset>
        {type.fields.includes("notes.custom") ? (
          <div className="space-y-1.5">
            <Label htmlFor="doc-note">Custom note</Label>
            <Textarea id="doc-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="bg-surface" />
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => { setPreviewQuery(query); setPreviewKey((k) => k + 1); }}>
            <RefreshCw aria-hidden="true" /> Update preview
          </Button>
          {pdfAvailable ? (
            <Button type="button" onClick={generate} disabled={pending || (!!type.sourceLabel && !sourceId)}>
              <Download aria-hidden="true" /> {pending ? "Generating…" : "Generate PDF"}
            </Button>
          ) : null}
          <Button type="button" variant={pdfAvailable ? "outline" : "default"} onClick={print}>
            <Printer aria-hidden="true" /> Print / Save as PDF
          </Button>
        </div>
        {!pdfAvailable ? (
          <p className="text-xs text-text-muted">No PDF service is set up yet, so use Print and choose “Save as PDF”. A record of the copy is kept when you click Generate.</p>
        ) : null}
        {!pdfAvailable ? (
          <Button type="button" variant="ghost" size="sm" onClick={generate} disabled={pending}>Record this copy</Button>
        ) : null}
        <div className="space-y-2 border-t border-border pt-4">
          <Label htmlFor="preset-name">Save these choices as a preset</Label>
          <div className="flex gap-2">
            <Input id="preset-name" value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="e.g. Quotation for families" className="bg-surface" />
            <Button
              type="button"
              variant="outline"
              disabled={!presetName.trim() || pending}
              onClick={() =>
                start(async () => {
                  const result = await savePresetAction({ name: presetName, type: typeKey, template, fields: fieldList, shared: sharePreset });
                  if (!result.ok) {
                    toast.error(result.message ?? "Couldn't save the preset");
                    return;
                  }
                  toast.success(result.message ?? "Saved");
                  setPresets((all) => [...all, { id: String(result.data!.id), name: presetName, type: typeKey, template, fields: fieldList, shared: sharePreset }]);
                  setPresetName("");
                })
              }
            >
              <Save aria-hidden="true" /> Save
            </Button>
          </div>
          {canSharePresets ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sharePreset} onChange={(e) => setSharePreset(e.target.checked)} className="accent-primary" /> Share with all staff
            </label>
          ) : null}
        </div>
      </div>
      <div className="min-w-0">
        <p className="mb-2 text-sm text-text-muted">Preview (A4). Click “Update preview” after ticking fields.</p>
        <iframe
          key={previewKey}
          ref={frame}
          title="Document preview"
          src={`/api/documents/preview?${previewQuery}`}
          className="h-[80vh] w-full rounded-lg border border-border bg-surface"
        />
      </div>
    </div>
  );
}
