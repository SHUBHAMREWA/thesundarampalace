import { ActionPanel } from "@/components/crm/action-kit";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/forms/form-kit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SETTINGS_LABELS, type SettingsSection } from "@/lib/settings/schemas";
import { saveSettingsAction } from "@/server/actions/settings";

type All = {
  numbering: SettingsSection<"numbering">;
  bookingPolicy: SettingsSection<"bookingPolicy">;
  tax: SettingsSection<"tax">;
  documents: SettingsSection<"documents">;
};

/** Booking, money and document settings (Phase 3). Default numbers are placeholders to confirm. */
export function PolicySettings({ settings, policies }: { settings: All; policies: { id: string; name: string }[] }) {
  const n = settings.numbering;
  const b = settings.bookingPolicy;
  const tx = settings.tax;
  const d = settings.documents;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{SETTINGS_LABELS.bookingPolicy}</CardTitle>
          <p className="text-sm text-text-muted">The starting values are placeholders — confirm each with the owner.</p>
        </CardHeader>
        <CardContent>
          <ActionPanel action={saveSettingsAction.bind(null, "bookingPolicy")} submitLabel="Save booking policy">
            <div className="grid gap-4 md:grid-cols-3">
              <TextField name="holdDurationHours" label="Tentative hold lasts (hours)" type="number" min={1} defaultValue={b.holdDurationHours} />
              <TextField name="holdReminderHoursBefore" label="Remind before expiry (hours)" type="number" min={0} defaultValue={b.holdReminderHoursBefore} />
              <TextField name="guestCountLockDays" label="Plates lock (days before function)" type="number" min={0} defaultValue={b.guestCountLockDays} />
              <TextField name="advancePercent" label="Suggested advance (% of total)" inputMode="decimal" defaultValue={b.advancePercent ?? ""} />
              <TextField name="quotationValidityDays" label="Quotation valid for (days)" type="number" min={1} defaultValue={b.quotationValidityDays} />
              <SelectField name="defaultCancellationPolicyId" label="Cancellation policy for new confirmations" options={policies.map((p) => ({ value: p.id, label: p.name }))} defaultValue={b.defaultCancellationPolicyId ?? ""} placeholder="None yet" />
            </div>
            <CheckboxField name="refundPlateShortfall" label="Refund guaranteed plates that weren't served" defaultChecked={b.refundPlateShortfall} />
          </ActionPanel>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{SETTINGS_LABELS.tax}</CardTitle>
          <p className="text-sm text-text-muted">Rates and SAC codes are set per tax category in Catalog and pricing. Confirm everything with the accountant.</p>
        </CardHeader>
        <CardContent>
          <ActionPanel action={saveSettingsAction.bind(null, "tax")} submitLabel="Save tax settings">
            <CheckboxField name="pricesIncludeTaxByDefault" label="New quotations: prices include GST" defaultChecked={tx.pricesIncludeTaxByDefault} />
            <CheckboxField name="roundGrandTotal" label="Round totals to the nearest rupee" defaultChecked={tx.roundGrandTotal} />
            <TextAreaField name="invoiceNotes" label="Printed under invoice totals" rows={2} defaultValue={tx.invoiceNotes ?? ""} hint="e.g. the reverse-charge statement your accountant requires." />
          </ActionPanel>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{SETTINGS_LABELS.numbering}</CardTitle>
          <p className="text-sm text-text-muted">Invoice and credit-note prefixes: 1–4 letters/digits (GST numbers are limited to 16 characters, e.g. SP/26-27/0001). A new prefix starts with the next financial year.</p>
        </CardHeader>
        <CardContent>
          <ActionPanel action={saveSettingsAction.bind(null, "numbering")} submitLabel="Save numbering">
            <div className="grid gap-4 md:grid-cols-3">
              <TextField name="leadPrefix" label="Leads" defaultValue={n.leadPrefix} />
              <TextField name="customerPrefix" label="Customers" defaultValue={n.customerPrefix} />
              <TextField name="bookingPrefix" label="Bookings" defaultValue={n.bookingPrefix} />
              <TextField name="receiptPrefix" label="Payment receipts" defaultValue={n.receiptPrefix} />
              <TextField name="invoicePrefix" label="Tax invoices" defaultValue={n.invoicePrefix} />
              <TextField name="creditNotePrefix" label="Credit notes" defaultValue={n.creditNotePrefix} />
            </div>
          </ActionPanel>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{SETTINGS_LABELS.documents}</CardTitle></CardHeader>
        <CardContent>
          <ActionPanel action={saveSettingsAction.bind(null, "documents")} submitLabel="Save document wording">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField name="tagline" label="Line under the business name" defaultValue={d.tagline ?? ""} />
              <TextField name="maxUploadMb" label="Largest private upload (MB, max 4)" type="number" min={1} max={4} defaultValue={d.maxUploadMb} />
            </div>
            <TextAreaField name="quotationTerms" label="Quotation terms" rows={4} defaultValue={d.quotationTerms ?? ""} />
            <TextAreaField name="paymentTerms" label="Payment terms" rows={3} defaultValue={d.paymentTerms ?? ""} />
            <TextAreaField name="bookingConditions" label="Booking conditions" rows={4} defaultValue={d.bookingConditions ?? ""} />
            <TextAreaField name="bankDetails" label="Bank details (account name, number, IFSC, UPI ID)" rows={3} defaultValue={d.bankDetails ?? ""} />
            <TextAreaField name="footerText" label="Footer" rows={2} defaultValue={d.footerText ?? ""} />
          </ActionPanel>
        </CardContent>
      </Card>
    </>
  );
}
