"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { localizedFromForm } from "@/lib/i18n/localized";
import { normalizePhone } from "@/lib/validation/phone";
import { getCurrentUser } from "@/server/auth/session";
import { CMS_TAG } from "@/server/cms/queries";
import { assertPermission } from "@/server/policies/authorize";
import { recordAudit } from "@/server/services/audit";
import { getSettings, saveSettings } from "@/server/services/settings";

import { checkbox, runAction, text, type ActionState } from "./helpers";

const SECTIONS = ["business", "contact", "enquiry", "numbering", "bookingPolicy", "tax", "documents"] as const;
type EditableSection = (typeof SECTIONS)[number];

function phoneOrNull(value: string | undefined, field: string): string | null {
  if (!value?.trim()) return null;
  const normalized = normalizePhone(value);
  if (!normalized) throw new z.ZodError([{ code: "custom", path: [field], message: "Enter a valid phone number", input: value }]);
  return normalized;
}

function valuesFor(section: EditableSection, form: FormData, current: Record<string, unknown>) {
  const s = (name: string) => text(form, name) ?? "";
  switch (section) {
    case "business":
      return {
        ...current,
        displayName: s("displayName"),
        legalName: s("legalName") || null,
        address: s("address") || null,
        city: s("city") || null,
        phone: phoneOrNull(s("phone"), "phone"),
        whatsapp: phoneOrNull(s("whatsapp"), "whatsapp"),
        email: s("email") || null,
        officeHours: s("officeHours") || null,
      };
    case "contact":
      return {
        mapEmbedUrl: s("mapEmbedUrl") || null,
        mapLink: s("mapLink") || null,
        directions: localizedFromForm(form, "directions"),
        whatsappMessage: localizedFromForm(form, "whatsappMessage"),
        googleReviewsUrl: s("googleReviewsUrl") || null,
        instagramUrl: s("instagramUrl") || null,
        facebookUrl: s("facebookUrl") || null,
        youtubeUrl: s("youtubeUrl") || null,
      };
    case "enquiry":
      return {
        ...current,
        duplicateWindowDays: Number(s("duplicateWindowDays") || 0),
        responseTimePromise: localizedFromForm(form, "responseTimePromise"),
        defaultAssigneeId: s("defaultAssigneeId") || null,
        consentNoticeVersion: s("consentNoticeVersion"),
      };
    case "numbering":
      return {
        leadPrefix: s("leadPrefix"),
        bookingPrefix: s("bookingPrefix"),
        customerPrefix: s("customerPrefix"),
        receiptPrefix: s("receiptPrefix"),
        invoicePrefix: s("invoicePrefix"),
        creditNotePrefix: s("creditNotePrefix"),
      };
    case "bookingPolicy":
      return {
        holdDurationHours: Number(s("holdDurationHours")),
        holdReminderHoursBefore: Number(s("holdReminderHoursBefore")),
        guestCountLockDays: Number(s("guestCountLockDays")),
        advancePercent: s("advancePercent") || null,
        quotationValidityDays: Number(s("quotationValidityDays")),
        defaultCancellationPolicyId: s("defaultCancellationPolicyId") || null,
        refundPlateShortfall: checkbox(form, "refundPlateShortfall"),
      };
    case "tax":
      return {
        roundGrandTotal: checkbox(form, "roundGrandTotal"),
        invoiceNotes: s("invoiceNotes") || null,
      };
    case "documents":
      return {
        tagline: s("tagline") || null,
        footerText: s("footerText") || null,
        quotationTerms: s("quotationTerms") || null,
        paymentTerms: s("paymentTerms") || null,
        bookingConditions: s("bookingConditions") || null,
        bankDetails: s("bankDetails") || null,
        maxUploadMb: Number(s("maxUploadMb")),
      };
  }
}

export async function saveSettingsAction(section: EditableSection, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const user = await getCurrentUser();
    assertPermission(user, "settings.manage");
    if (!SECTIONS.includes(section)) throw new Error("Unknown settings section");
    const current = (await getSettings(section)) as Record<string, unknown>;
    const saved = await saveSettings(section, valuesFor(section, form, current), user.id);
    await recordAudit({ actorId: user.id, action: "settings.saved", entityType: "site_setting", entityId: section, summary: { section } });
    if (section === "enquiry" && current.consentNoticeVersion !== (saved as Record<string, unknown>).consentNoticeVersion) {
      await recordAudit({ actorId: user.id, action: "consent.notice_version_changed", entityType: "site_setting", entityId: section, summary: { from: String(current.consentNoticeVersion), to: String((saved as Record<string, unknown>).consentNoticeVersion) } });
    }
    updateTag(CMS_TAG);
    revalidatePath("/admin/settings");
    return { message: "Settings saved. The website is updated." };
  });
}
