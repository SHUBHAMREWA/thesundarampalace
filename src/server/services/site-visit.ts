import "server-only";

import { z } from "zod";

import { db } from "@/lib/db";
import { istToUtc, todayIST } from "@/lib/time";
import { normalizePhone } from "@/lib/validation/phone";
import { notifyStaff } from "./notifications";
import { nextLeadReference } from "./numbering";
import { getSettings } from "./settings";

export const siteVisitSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .transform((val, ctx) => {
      const normalized = normalizePhone(val);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
        return z.NEVER;
      }
      return normalized;
    }),
  email: z.union([z.literal(""), z.string().email("Enter a valid email").trim().toLowerCase().max(200)]).optional().transform((v) => v || undefined),
  visitDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date")
    .refine((v) => v >= todayIST(), "Date must be today or in the future"),
  timeSlot: z.enum(["morning", "afternoon", "evening"]).default("morning"),
  preferredHallSlug: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
  consent: z.literal(true, { error: "Consent is required" }),
});

export type SiteVisitInput = z.infer<typeof siteVisitSchema>;

const SLOT_TIME_MAP: Record<string, string> = {
  morning: "11:00",
  afternoon: "14:30",
  evening: "17:00",
};

export async function bookSiteVisit(
  input: SiteVisitInput,
  context: { pagePath?: string; ip?: string | null; userAgent?: string | null } = {},
) {
  const now = new Date();
  const timeStr = SLOT_TIME_MAP[input.timeSlot] ?? "11:00";
  const siteVisitAt = istToUtc(input.visitDate, timeStr);

  const hall = input.preferredHallSlug
    ? await db.hall.findFirst({ where: { slug: input.preferredHallSlug, active: true }, select: { id: true, name: true } })
    : null;

  const [settings, statusScheduled] = await Promise.all([
    getSettings("enquiry"),
    db.lookupValue.findFirst({ where: { listKey: "lead_status", key: "site_visit_scheduled" } }),
  ]);

  const scheduledStatusKey = statusScheduled?.key ?? "site_visit_scheduled";

  const result = await db.$transaction(async (tx) => {
    // Check if open lead exists for this phone
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
    let assigneeId: string | null;

    if (existing) {
      leadId = existing.id;
      reference = existing.reference;
      assigneeId = existing.assignedToId;

      await tx.lead.update({
        where: { id: existing.id },
        data: {
          lastActivityAt: now,
          statusKey: scheduledStatusKey,
          siteVisitAt,
          preferredHallId: existing.preferredHallId ?? hall?.id ?? null,
          email: existing.email ?? input.email ?? null,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId,
          kind: "SITE_VISIT",
          note: `Site visit scheduled for ${input.visitDate} (${input.timeSlot}). ${input.notes ?? ""}`.trim(),
        },
      });
    } else {
      reference = await nextLeadReference(tx, now);
      assigneeId = settings.defaultAssigneeId;

      const created = await tx.lead.create({
        data: {
          reference,
          fullName: input.fullName,
          phone: input.phone,
          email: input.email ?? null,
          contactPreference: "phone",
          sourceKey: "site_visit_form",
          statusKey: scheduledStatusKey,
          preferredHallId: hall?.id ?? null,
          siteVisitAt,
          message: input.notes ?? null,
          assignedToId: assigneeId,
          lastActivityAt: now,
        },
      });
      leadId = created.id;

      await tx.consentRecord.create({
        data: {
          subjectType: "LEAD",
          subjectId: leadId,
          purpose: "site_visit",
          granted: true,
          source: "web_form",
          noticeVersion: "1.0",
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId,
          kind: "SITE_VISIT",
          note: `Site visit booked for ${input.visitDate} (${input.timeSlot})`,
        },
      });
    }

    // Log conversion event
    await tx.conversionEvent.create({
      data: {
        type: "site_visit_booked",
        page: context?.pagePath ?? "/site-visit",
      },
    });

    // Notify staff
    const staffToNotify = await tx.user.findMany({
      where: {
        active: true,
        roles: { some: { role: { permissions: { some: { permissionKey: "leads.read" } } } } },
      },
      select: { id: true },
    });

    if (staffToNotify.length) {
      await notifyStaff(tx, {
        userIds: staffToNotify.map((u) => u.id),
        kind: "lead.site_visit",
        title: `Site visit booked: ${input.fullName} (${input.visitDate})`,
        link: `/admin/leads/${leadId}`,
      });
    }

    return { leadId, reference };
  });

  return result;
}
