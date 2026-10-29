import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { t } from "@/lib/i18n/localized";
import { esc } from "@/lib/pdf/html";
import { normalizePhone } from "@/lib/validation/phone";
import { documentAssets } from "@/server/documents/assets";
import { renderPdf } from "@/server/documents/renderer";
import { nextLeadReference } from "./numbering";
import { getSettings } from "./settings";

export const brochureLeadSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .transform((val, ctx) => {
      const normalized = normalizePhone(val);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
        return z.NEVER;
      }
      return normalized;
    }),
  email: z.union([z.literal(""), z.string().email("Enter a valid email").trim().toLowerCase().max(200)]).optional().transform((v) => v || undefined),
  preferredDate: z.string().trim().optional(),
  consent: z.literal(true, { error: "Consent is required" }),
});

export type BrochureLeadInput = z.infer<typeof brochureLeadSchema>;

export async function generateBrochureHtml(locale: "en" | "hi" = "en"): Promise<string> {
  const [halls, menus, _contact] = await Promise.all([
    db.hall.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { name: true, description: true } }),
    db.menu.findMany({ where: { publicVisible: true }, select: { name: true, category: true } }),
    getSettings("contact").catch(() => null),
  ]);

  let assets = { tokensCss: "", fontsCss: "" };
  try {
    assets = documentAssets();
  } catch {
    // Assets unavailable in non-bundled environments
  }

  const isHindi = locale === "hi";

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <title>The Sundaram Palace — E-Brochure</title>
  <style>
    :root { ${assets.tokensCss} }
    ${assets.fontsCss}
    @page { size: A4 portrait; margin: 16mm 14mm 18mm 14mm; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: var(--color-text); background: var(--color-surface); line-height: 1.5; margin: 0; padding: 0; }
    .header { text-align: center; border-bottom: 2px solid var(--color-gold); padding-bottom: 14px; margin-bottom: 20px; }
    h1 { font-family: 'Cormorant Garamond', Georgia, serif; color: var(--color-primary); font-size: 26pt; margin: 0 0 4px 0; font-weight: 600; letter-spacing: 0.5px; }
    .subtitle { color: var(--color-gold); font-size: 11pt; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 500; }
    .section { margin-bottom: 22px; page-break-inside: avoid; }
    h2 { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 16pt; color: var(--color-primary); border-bottom: 1px solid var(--color-border); padding-bottom: 4px; margin: 16px 0 10px 0; }
    .lead-p { font-size: 10pt; color: var(--color-text-muted); margin-bottom: 14px; }
    .grid { display: flex; flex-wrap: wrap; gap: 12px; }
    .card { flex: 1 1 45%; border: 1px solid var(--color-border); border-radius: 6px; padding: 10px 14px; background: var(--color-surface); }
    .card-title { font-weight: 600; font-size: 11pt; color: var(--color-primary); margin-bottom: 4px; }
    .card-desc { font-size: 9pt; color: var(--color-text-muted); }
    .pill { display: inline-block; background: var(--color-blush); color: var(--color-primary); font-size: 7.5pt; font-weight: 600; padding: 2px 7px; border-radius: 4px; margin-right: 4px; margin-top: 4px; }
    .footer { text-align: center; font-size: 8.5pt; color: var(--color-text-muted); border-top: 1px solid var(--color-border); padding-top: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${isHindi ? "द सुंदरम पैलेस" : "The Sundaram Palace"}</h1>
    <p class="subtitle">${isHindi ? "उत्कृष्ट विवाह एवं भव्य बैंक्वेट स्थल" : "Luxury Wedding & Banquet Destination"}</p>
  </div>

  <p class="lead-p">
    ${
      isHindi
        ? "द सुंदरम पैलेस भारत के सबसे प्रतिष्ठित विवाह और मांगलिक उत्सव स्थलों में से एक है। हमारी वास्तुकला, शाही साज-सज्जा और उत्कृष्ट आतिथ्य आपके विशेष क्षणों को अविस्मरणीय बनाते हैं।"
        : "Welcome to The Sundaram Palace — an exceptional destination crafted exclusively for grand Indian weddings, receptions, and family celebrations. Combining palatial aesthetics with meticulous hospitality."
    }
  </p>

  <div class="section">
    <h2>${isHindi ? "भव्य स्थल एवं हॉल" : "Our Venue Spaces"}</h2>
    <div class="grid">
      ${halls
        .map(
          (h) => `
        <div class="card">
          <div class="card-title">${esc(t(h.name, locale))}</div>
          <div class="card-desc">${esc(t(h.description, locale))}</div>
        </div>
      `,
        )
        .join("")}
    </div>
  </div>

  <div class="section">
    <h2>${isHindi ? "शाही खानपान एवं व्यंजन" : "Culinary Excellence"}</h2>
    <p class="card-desc">
      ${
        isHindi
          ? "हमारे अनुभवी शेफ द्वारा तैयार की गई प्रामाणिक व्यंजन सूचियां: शुद्ध शाकाहारी, जैन परंपरा अनुकूल और विशेष लाइव काउंटर।"
          : "Featuring masterfully curated catering menus tailored for royal feasts: Pure Vegetarian, traditional Jain options, and live gourmet counters."
      }
    </p>
    <div class="grid">
      ${menus
        .map(
          (m) => `
        <div class="card">
          <div class="card-title">${t(m.name, locale)}</div>
          <div class="card-desc">Category: ${m.category.toUpperCase()}</div>
        </div>
      `,
        )
        .join("")}
    </div>
  </div>

  <div class="section">
    <h2>${isHindi ? "संपर्क एवं स्थल भ्रमण" : "Contact & Visit Booking"}</h2>
    <div class="card" style="width: 100%;">
      <p style="margin: 0; font-size: 9.5pt;">
        <strong>The Sundaram Palace</strong><br>
        Website: thesundarampalace.com &bull; Inquiries: WhatsApp &bull; Direct Phone<br>
        Schedule an in-person walkthrough at <em>thesundarampalace.com/site-visit</em>
      </p>
    </div>
  </div>

  <div class="footer">
    The Sundaram Palace &bull; All Rights Reserved &bull; Luxury Banquet & Wedding Venue
  </div>
</body>
</html>`;
}

export async function generateBrochurePdf(locale: "en" | "hi" = "en"): Promise<Buffer | null> {
  const html = await generateBrochureHtml(locale);
  return renderPdf(html, "SP-BROCHURE-2026");
}

export async function recordBrochureDownloadLead(input: BrochureLeadInput) {
  const now = new Date();
  const settings = await getSettings("enquiry");

  return db.$transaction(async (tx) => {
    // Check if open lead exists
    const existing = await tx.lead.findFirst({
      where: {
        phone: input.phone,
        deletedAt: null,
        statusKey: { notIn: ["won", "lost"] },
      },
      orderBy: { createdAt: "desc" },
    });

    let leadId: string;
    let reference: string;

    if (existing) {
      leadId = existing.id;
      reference = existing.reference;

      await tx.lead.update({
        where: { id: existing.id },
        data: {
          lastActivityAt: now,
          email: existing.email ?? input.email ?? null,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId,
          kind: "NOTE",
          note: "Downloaded official venue e-brochure",
        },
      });
    } else {
      reference = await nextLeadReference(tx, now);

      const created = await tx.lead.create({
        data: {
          reference,
          fullName: input.fullName,
          phone: input.phone,
          email: input.email ?? null,
          contactPreference: "phone",
          sourceKey: "brochure_download",
          statusKey: "new",
          assignedToId: settings.defaultAssigneeId,
          lastActivityAt: now,
        },
      });
      leadId = created.id;

      await tx.consentRecord.create({
        data: {
          subjectType: "LEAD",
          subjectId: leadId,
          purpose: "brochure",
          granted: true,
          source: "web_form",
          noticeVersion: "1.0",
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId,
          kind: "CREATED",
          note: "Downloaded official venue e-brochure",
        },
      });
    }

    // Log conversion event
    await tx.conversionEvent.create({
      data: {
        type: "brochure_download",
        page: "/brochure",
      },
    });

    return { leadId, reference };
  });
}
