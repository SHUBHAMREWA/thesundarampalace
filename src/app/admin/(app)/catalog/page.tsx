import en from "@messages/en.json";
import type { Metadata } from "next";
import Link from "next/link";

import { ActionPanel } from "@/components/crm/action-kit";
import { PageHeader } from "@/components/crm/page-header";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/forms/form-kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MENU_COURSES } from "@/lib/content/catalog";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { formatINR } from "@/lib/money";
import { dateKey, formatDateKey, todayIST } from "@/lib/time";
import {
  addTaxRateAction,
  saveCancellationPolicyAction,
  saveHallRulesAction,
  saveMenuPackageAction,
  savePackagePricingAction,
  savePricingRuleAction,
  saveServiceItemAction,
  saveSlotAction,
  saveTaxCategoryAction,
} from "@/server/actions/catalog";
import { requirePermission } from "@/server/auth/session";
import { parseSelectionRules, parseSlabs, taxCategoriesWithRates } from "@/server/services/catalog";
import { lookupOptions } from "@/server/services/lookups";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Catalog and pricing" };

const TABS = [
  { key: "halls", label: "Halls and slots" },
  { key: "taxes", label: "Taxes" },
  { key: "services", label: "Services" },
  { key: "menus", label: "Menu packages" },
  { key: "packages", label: "Packages" },
  { key: "pricing", label: "Pricing rules" },
  { key: "cancellation", label: "Cancellation" },
] as const;

const COURSES = en.catalog.course as Record<string, string>;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ROWS = [0, 1, 2, 3, 4, 5];

export default async function CatalogPage({ searchParams }: PageProps<"/admin/catalog">) {
  await requirePermission("catalog.manage");
  const params = await searchParams;
  const tab = TABS.find((x) => x.key === params.tab)?.key ?? "halls";
  const taxes = await taxCategoriesWithRates();
  const taxOptions = taxes.filter((x) => x.active).map((x) => ({ value: x.id, label: `${x.name} (SAC ${x.sacCode}${x.currentRate ? `, ${x.currentRate.ratePercent.toString()}%` : ", no rate yet"})` }));

  return (
    <>
      <PageHeader
        title="Catalog and pricing"
        description="Every number here comes from the business (and tax values from its accountant). Changes apply to new quotations only."
        crumbs={[{ label: "Dashboard", href: "/admin" }, { label: "Catalog and pricing" }]}
      />
      <nav aria-label="Catalog sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((x) => (
          <Link
            key={x.key}
            href={`/admin/catalog?tab=${x.key}`}
            aria-current={x.key === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap ${x.key === tab ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text"}`}
          >
            {x.label}
          </Link>
        ))}
      </nav>
      {tab === "halls" ? <HallsTab /> : null}
      {tab === "taxes" ? <TaxesTab taxes={taxes} /> : null}
      {tab === "services" ? <ServicesTab taxOptions={taxOptions} /> : null}
      {tab === "menus" ? <MenusTab taxOptions={taxOptions} /> : null}
      {tab === "packages" ? <PackagesTab taxOptions={taxOptions} /> : null}
      {tab === "pricing" ? <PricingTab /> : null}
      {tab === "cancellation" ? <CancellationTab /> : null}
    </>
  );
}

async function HallsTab() {
  const [halls, slots] = await Promise.all([
    db.hall.findMany({ orderBy: { sortOrder: "asc" }, include: { members: true } }),
    db.slotDefinition.findMany({ orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }], include: { hall: { select: { name: true } } } }),
  ]);
  const hallOptions = halls.map((h) => ({ value: h.id, label: t(h.name, "en") }));
  const ordinary = halls.filter((h) => !h.isComposite);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Booking rules per hall</CardTitle>
          <p className="text-sm text-text-muted">Halls themselves (names, photos, capacities) are edited in Website CMS → Halls. Buffers are added before and after every function when checking clashes.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {halls.length ? null : <p className="text-sm text-text-muted">No halls yet. Add them in Website CMS → Halls.</p>}
          {halls.map((h) => (
            <details key={h.id} className="rounded-lg border border-border p-4">
              <summary className="cursor-pointer font-medium">
                {t(h.name, "en")} <span className="text-sm font-normal text-text-muted">· setup {h.setupBufferMinutes} min · teardown {h.teardownBufferMinutes} min{h.isComposite ? ` · combined (${h.members.length} halls)` : ""}{h.active ? "" : " · inactive"}</span>
              </summary>
              <div className="mt-4">
                <ActionPanel action={saveHallRulesAction.bind(null, h.id)} submitLabel="Save rules">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="setupBufferMinutes" label="Setup buffer (minutes before)" type="number" min={0} defaultValue={h.setupBufferMinutes} />
                    <TextField name="teardownBufferMinutes" label="Teardown buffer (minutes after)" type="number" min={0} defaultValue={h.teardownBufferMinutes} />
                  </div>
                  <CheckboxField name="isComposite" label="This is a combined space made of other halls" defaultChecked={h.isComposite} />
                  <fieldset className="space-y-1">
                    <legend className="text-sm">Member halls (for a combined space)</legend>
                    {ordinary.filter((o) => o.id !== h.id).map((o) => (
                      <label key={o.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="memberHallIds" value={o.id} defaultChecked={h.members.some((m) => m.memberHallId === o.id)} className="size-4 accent-primary" />
                        {t(o.name, "en")}
                      </label>
                    ))}
                  </fieldset>
                </ActionPanel>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Slots</CardTitle>
          <p className="text-sm text-text-muted">Times in IST from the business. An end time earlier than the start means the slot ends the next day (e.g. 18:00–01:00).</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {slots.map((s) => (
            <details key={s.id} className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm">
                <strong>{s.name}</strong> · {s.startTime}–{s.endTime} · {s.hall ? t(s.hall.name, "en") : "all halls"} {s.active ? null : <Badge variant="secondary">inactive</Badge>}
              </summary>
              <div className="mt-3"><SlotForm id={s.id} hallOptions={hallOptions} defaults={{ name: s.name, startTime: s.startTime, endTime: s.endTime, hallId: s.hallId ?? "", sortOrder: String(s.sortOrder), active: s.active }} /></div>
            </details>
          ))}
          <div className="rounded-lg border border-dashed border-border p-4">
            <h3 className="mb-3 text-sm font-semibold">Add a slot</h3>
            <SlotForm id={null} hallOptions={hallOptions} defaults={{ name: "", startTime: "", endTime: "", hallId: "", sortOrder: "0", active: true }} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SlotForm({ id, hallOptions, defaults }: { id: string | null; hallOptions: { value: string; label: string }[]; defaults: { name: string; startTime: string; endTime: string; hallId: string; sortOrder: string; active: boolean } }) {
  return (
    <ActionPanel action={saveSlotAction.bind(null, id)} submitLabel={id ? "Save slot" : "Add slot"} resetAfter={!id}>
      <div className="grid gap-3 sm:grid-cols-5">
        <TextField name="name" label="Name" defaultValue={defaults.name} placeholder="Evening" />
        <TextField name="startTime" label="Starts" type="time" defaultValue={defaults.startTime} />
        <TextField name="endTime" label="Ends" type="time" defaultValue={defaults.endTime} />
        <SelectField name="hallId" label="Hall" options={hallOptions} defaultValue={defaults.hallId} placeholder="All halls" />
        <TextField name="sortOrder" label="Order" type="number" defaultValue={defaults.sortOrder} />
      </div>
      <CheckboxField name="active" label="Active" defaultChecked={defaults.active} />
    </ActionPanel>
  );
}

function TaxesTab({ taxes }: { taxes: Awaited<ReturnType<typeof taxCategoriesWithRates>> }) {
  return (
    <div className="space-y-6">
      <p className="rounded-md border border-warning/40 bg-surface p-3 text-sm text-warning">
        GST rates and SAC codes must be confirmed by the business&apos;s accountant before real use. A rate change is added with its start date; issued documents keep their old rate.
      </p>
      {taxes.map((x) => (
        <Card key={x.id}>
          <CardHeader>
            <CardTitle className="text-base">{x.name} · SAC {x.sacCode} {x.active ? null : <Badge variant="secondary">inactive</Badge>}</CardTitle>
            <p className="text-sm text-text-muted">
              {x.currentRate ? `In force today: ${x.currentRate.ratePercent.toString()}%` : "No rate in force today"} · history: {x.rates.map((r) => `${r.ratePercent.toString()}% from ${formatDateKey(dateKey(r.effectiveFrom))}`).join("; ")}
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <ActionPanel action={saveTaxCategoryAction.bind(null, x.id)} submitLabel="Save">
              <TextField name="name" label="Name" defaultValue={x.name} />
              <TextField name="sacCode" label="SAC code" defaultValue={x.sacCode} />
              <TextAreaField name="notes" label="Notes" rows={2} defaultValue={x.notes ?? ""} />
              <CheckboxField name="active" label="Active" defaultChecked={x.active} />
            </ActionPanel>
            <ActionPanel action={addTaxRateAction.bind(null, x.id)} submitLabel="Add rate" resetAfter>
              <TextField name="ratePercent" label="New GST rate (%)" inputMode="decimal" />
              <TextField name="effectiveFrom" label="From date" type="date" defaultValue={todayIST()} />
            </ActionPanel>
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader><CardTitle className="text-base">Add a tax category</CardTitle></CardHeader>
        <CardContent>
          <ActionPanel action={saveTaxCategoryAction.bind(null, null)} submitLabel="Add tax category" resetAfter>
            <div className="grid gap-3 sm:grid-cols-4">
              <TextField name="name" label="Name" placeholder="e.g. Hall rental" />
              <TextField name="sacCode" label="SAC code" />
              <TextField name="ratePercent" label="GST rate (%)" inputMode="decimal" />
              <TextField name="effectiveFrom" label="From date" type="date" defaultValue={todayIST()} />
            </div>
            <TextAreaField name="notes" label="Notes (e.g. confirmed by accountant on …)" rows={2} />
            <input type="hidden" name="active" value="on" />
          </ActionPanel>
        </CardContent>
      </Card>
    </div>
  );
}

async function ServicesTab({ taxOptions }: { taxOptions: { value: string; label: string }[] }) {
  const [services, categories] = await Promise.all([db.serviceItem.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }), lookupOptions("service_category")]);
  const form = (id: string | null, d: { name?: string; categoryKey?: string; taxCategoryId?: string; unit?: string; defaultPrice?: string; sortOrder?: string; description?: string; active?: boolean }) => (
    <ActionPanel action={saveServiceItemAction.bind(null, id)} submitLabel={id ? "Save" : "Add service"} resetAfter={!id}>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField name="name" label="Name" defaultValue={d.name} />
        <SelectField name="categoryKey" label="Category" options={categories} defaultValue={d.categoryKey ?? ""} placeholder="Choose…" />
        <SelectField name="taxCategoryId" label="Tax category" options={taxOptions} defaultValue={d.taxCategoryId ?? ""} placeholder="Choose…" />
        <TextField name="unit" label="Unit" defaultValue={d.unit ?? "event"} />
        <TextField name="defaultPrice" label="Default price (₹, optional)" inputMode="decimal" defaultValue={d.defaultPrice} />
        <TextField name="sortOrder" label="Order" type="number" defaultValue={d.sortOrder ?? "0"} />
      </div>
      <TextAreaField name="description" label="Description" rows={2} defaultValue={d.description} />
      <CheckboxField name="active" label="Active" defaultChecked={d.active ?? true} />
    </ActionPanel>
  );
  return (
    <div className="space-y-4">
      {services.map((s) => (
        <details key={s.id} className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer"><strong>{s.name}</strong> <span className="text-sm text-text-muted">· {s.unit}{s.defaultPrice ? ` · ${formatINR(s.defaultPrice)}` : ""}{s.active ? "" : " · inactive"}</span></summary>
          <div className="mt-3">{form(s.id, { name: s.name, categoryKey: s.categoryKey, taxCategoryId: s.taxCategoryId, unit: s.unit, defaultPrice: s.defaultPrice?.toFixed(2) ?? "", sortOrder: String(s.sortOrder), description: s.description ?? "", active: s.active })}</div>
        </details>
      ))}
      <Card>
        <CardHeader><CardTitle className="text-base">Add a service</CardTitle></CardHeader>
        <CardContent>{taxOptions.length ? form(null, {}) : <p className="text-sm text-text-muted">Add a tax category first.</p>}</CardContent>
      </Card>
    </div>
  );
}

async function MenusTab({ taxOptions }: { taxOptions: { value: string; label: string }[] }) {
  const [menus, packages] = await Promise.all([
    db.menu.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.menuPackage.findMany({ orderBy: { sortOrder: "asc" }, include: { menu: { select: { name: true } } } }),
  ]);
  const menuOptions = menus.map((m) => ({ value: m.id, label: t(m.name, "en") }));
  const courseOptions = MENU_COURSES.map((c) => ({ value: c, label: COURSES[c] ?? c }));
  const form = (id: string | null, d: { menuId?: string; name?: string; perPlateRate?: string; minPlates?: string; taxCategoryId?: string; sortOrder?: string; active?: boolean; rules?: { course: string; choose: number }[] }) => (
    <ActionPanel action={saveMenuPackageAction.bind(null, id)} submitLabel={id ? "Save" : "Add menu package"} resetAfter={!id}>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField name="menuId" label="Menu (items come from Website CMS → Menus)" options={menuOptions} defaultValue={d.menuId ?? ""} placeholder="Choose…" />
        <TextField name="name" label="Package name" defaultValue={d.name} />
        <SelectField name="taxCategoryId" label="Tax category" options={taxOptions} defaultValue={d.taxCategoryId ?? ""} placeholder="Choose…" />
        <TextField name="perPlateRate" label="Per-plate rate (₹)" inputMode="decimal" defaultValue={d.perPlateRate} />
        <TextField name="minPlates" label="Minimum guaranteed plates" type="number" defaultValue={d.minPlates} />
        <TextField name="sortOrder" label="Order" type="number" defaultValue={d.sortOrder ?? "0"} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Choice rules (e.g. choose 3 starters). Courses without a rule are served in full.</legend>
        {ROWS.map((i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <SelectField name={`rules.${i}.course`} label={`Course ${i + 1}`} options={courseOptions} defaultValue={d.rules?.[i]?.course ?? ""} placeholder="—" />
            <TextField name={`rules.${i}.choose`} label="Choose how many" type="number" min={1} defaultValue={d.rules?.[i]?.choose?.toString() ?? ""} />
          </div>
        ))}
      </fieldset>
      <CheckboxField name="active" label="Active" defaultChecked={d.active ?? true} />
    </ActionPanel>
  );
  return (
    <div className="space-y-4">
      {packages.map((p) => (
        <details key={p.id} className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer"><strong>{p.name}</strong> <span className="text-sm text-text-muted">· {t(p.menu.name, "en")} · {formatINR(p.perPlateRate)}/plate{p.minPlates ? ` · min ${p.minPlates}` : ""}{p.active ? "" : " · inactive"}</span></summary>
          <div className="mt-3">{form(p.id, { menuId: p.menuId, name: p.name, perPlateRate: p.perPlateRate.toFixed(2), minPlates: p.minPlates?.toString() ?? "", taxCategoryId: p.taxCategoryId, sortOrder: String(p.sortOrder), active: p.active, rules: parseSelectionRules(p.selectionRules) })}</div>
        </details>
      ))}
      <Card>
        <CardHeader><CardTitle className="text-base">Add a menu package</CardTitle></CardHeader>
        <CardContent>{menus.length && taxOptions.length ? form(null, {}) : <p className="text-sm text-text-muted">Create a menu (Website CMS → Menus) and a tax category first.</p>}</CardContent>
      </Card>
    </div>
  );
}

async function PackagesTab({ taxOptions }: { taxOptions: { value: string; label: string }[] }) {
  const packages = await db.package.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">Package descriptions are edited in Website CMS → Packages. These prices are for quotations; the website shows a price only if “show public price” is on there.</p>
      {packages.length ? null : <p className="text-sm text-text-muted">No packages yet.</p>}
      {packages.map((p) => (
        <details key={p.id} className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer"><strong>{t(p.name, "en")}</strong> <span className="text-sm text-text-muted">· {p.crmPrice ? formatINR(p.crmPrice) : p.perPlateRate ? `${formatINR(p.perPlateRate)}/plate` : "no CRM price"}</span></summary>
          <div className="mt-3">
            <ActionPanel action={savePackagePricingAction.bind(null, p.id)} submitLabel="Save pricing">
              <div className="grid gap-3 sm:grid-cols-4">
                <TextField name="crmPrice" label="Package price (₹)" inputMode="decimal" defaultValue={p.crmPrice?.toFixed(2) ?? ""} />
                <TextField name="perPlateRate" label="Or per-plate rate (₹)" inputMode="decimal" defaultValue={p.perPlateRate?.toFixed(2) ?? ""} />
                <TextField name="minPlates" label="Minimum plates" type="number" defaultValue={p.minPlates?.toString() ?? ""} />
                <SelectField name="taxCategoryId" label="Tax category" options={taxOptions} defaultValue={p.taxCategoryId ?? ""} placeholder="—" />
              </div>
              <CheckboxField name="active" label="Available for new bookings" defaultChecked={p.active} />
            </ActionPanel>
          </div>
        </details>
      ))}
    </div>
  );
}

async function PricingTab() {
  const rules = await db.pricingRule.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  const form = (id: string | null, d: { name?: string; kind?: string; startDate?: string; endDate?: string; weekdays?: number[]; dates?: string; adjustmentType?: string; adjustmentValue?: string; appliesTo?: string; sortOrder?: string; active?: boolean }) => (
    <ActionPanel action={savePricingRuleAction.bind(null, id)} submitLabel={id ? "Save rule" : "Add rule"} resetAfter={!id}>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField name="name" label="Name" defaultValue={d.name} placeholder="e.g. Peak wedding season" />
        <SelectField name="kind" label="Applies on" options={[{ value: "SEASON", label: "A date range (season)" }, { value: "WEEKDAY", label: "Days of the week" }, { value: "DATE", label: "Named dates" }]} defaultValue={d.kind ?? "SEASON"} />
        <SelectField name="appliesTo" label="Adjusts" options={[{ value: "ALL", label: "All prices" }, { value: "PLATES", label: "Per-plate rates" }, { value: "PACKAGE", label: "Packages" }, { value: "SERVICE", label: "Services" }]} defaultValue={d.appliesTo ?? "ALL"} />
        <TextField name="startDate" label="Season from" type="date" defaultValue={d.startDate} />
        <TextField name="endDate" label="Season to" type="date" defaultValue={d.endDate} />
        <TextField name="dates" label="Named dates (YYYY-MM-DD, comma separated)" defaultValue={d.dates} />
        <SelectField name="adjustmentType" label="Adjustment" options={[{ value: "PERCENT", label: "Percent" }, { value: "AMOUNT", label: "Rupees" }]} defaultValue={d.adjustmentType ?? "PERCENT"} />
        <TextField name="adjustmentValue" label="Value (negative = discount)" defaultValue={d.adjustmentValue} />
        <TextField name="sortOrder" label="Order" type="number" defaultValue={d.sortOrder ?? "0"} />
      </div>
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="mb-1 w-full text-sm">Days of the week</legend>
        {WEEKDAYS.map((w, i) => (
          <label key={w} className="flex items-center gap-1">
            <input type="checkbox" name="weekdays" value={i} defaultChecked={d.weekdays?.includes(i)} className="size-4 accent-primary" /> {w}
          </label>
        ))}
      </fieldset>
      <CheckboxField name="active" label="Active" defaultChecked={d.active ?? true} />
    </ActionPanel>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">Rules adjust catalogue prices when lines are added to a new quotation. They never change sent quotations, bookings or invoices.</p>
      {rules.map((r) => (
        <details key={r.id} className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer"><strong>{r.name}</strong> <span className="text-sm text-text-muted">· {r.adjustmentType === "PERCENT" ? `${r.adjustmentValue.toString()}%` : formatINR(r.adjustmentValue)} · {r.appliesTo.toLowerCase()}{r.active ? "" : " · inactive"}</span></summary>
          <div className="mt-3">
            {form(r.id, {
              name: r.name,
              kind: r.kind,
              startDate: r.startDate ? dateKey(r.startDate) : "",
              endDate: r.endDate ? dateKey(r.endDate) : "",
              weekdays: Array.isArray(r.weekdays) ? (r.weekdays as number[]) : [],
              dates: Array.isArray(r.dates) ? (r.dates as string[]).join(", ") : "",
              adjustmentType: r.adjustmentType,
              adjustmentValue: r.adjustmentValue.toFixed(2),
              appliesTo: r.appliesTo,
              sortOrder: String(r.sortOrder),
              active: r.active,
            })}
          </div>
        </details>
      ))}
      <Card>
        <CardHeader><CardTitle className="text-base">Add a pricing rule</CardTitle></CardHeader>
        <CardContent>{form(null, {})}</CardContent>
      </Card>
    </div>
  );
}

async function CancellationTab() {
  const [policies, policy] = await Promise.all([db.cancellationPolicy.findMany({ orderBy: { createdAt: "asc" } }), getSettings("bookingPolicy")]);
  const form = (id: string | null, d: { name?: string; description?: string; slabs?: { daysBeforeEventMin: number; refundPercent: string }[]; active?: boolean }) => (
    <ActionPanel action={saveCancellationPolicyAction.bind(null, id)} submitLabel={id ? "Save policy" : "Add policy"} resetAfter={!id}>
      <TextField name="name" label="Name" defaultValue={d.name} />
      <TextAreaField name="description" label="Description" rows={2} defaultValue={d.description} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Slabs: refund % of the amount paid when cancelled at least N days before the first function</legend>
        {ROWS.map((i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-2">
            <TextField name={`slabs.${i}.daysBeforeEventMin`} label="Days before (at least)" type="number" min={0} defaultValue={d.slabs?.[i]?.daysBeforeEventMin?.toString() ?? ""} />
            <TextField name={`slabs.${i}.refundPercent`} label="Refund %" inputMode="decimal" defaultValue={d.slabs?.[i]?.refundPercent ?? ""} />
          </div>
        ))}
      </fieldset>
      <CheckboxField name="active" label="Active" defaultChecked={d.active ?? true} />
    </ActionPanel>
  );
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        The policy chosen in Settings → Booking policy is copied onto each booking when it is confirmed; later edits don&apos;t change confirmed bookings.
        {policy.defaultCancellationPolicyId ? null : " No default policy is chosen yet."}
      </p>
      {policies.map((p) => (
        <details key={p.id} className="rounded-lg border border-border bg-surface p-4">
          <summary className="cursor-pointer">
            <strong>{p.name}</strong> {p.id === policy.defaultCancellationPolicyId ? <Badge variant="success">default</Badge> : null} <span className="text-sm text-text-muted">· {parseSlabs(p.slabs).map((s) => `${s.daysBeforeEventMin}+ days → ${s.refundPercent}%`).join(", ")}</span>
          </summary>
          <div className="mt-3">{form(p.id, { name: p.name, description: p.description ?? "", slabs: parseSlabs(p.slabs), active: p.active })}</div>
        </details>
      ))}
      <Card>
        <CardHeader><CardTitle className="text-base">Add a cancellation policy</CardTitle></CardHeader>
        <CardContent>{form(null, {})}</CardContent>
      </Card>
    </div>
  );
}
