import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { maskPhone } from "@/lib/validation/phone";
import type { AttributionInput, EnquiryInput } from "@/lib/validation/enquiry";

import { notifyStaff } from "./notifications";
import { nextLeadReference } from "./numbering";
import { getSettings } from "./settings";

export type EnquiryContext = {
  locale: string;
  sourceKey: string; // lead_source key, e.g. "website_form"
  pagePath: string;
  attribution: AttributionInput;
  now?: Date;
};

export type EnquiryResult = { reference: string; leadId: string; merged: boolean };

/** Lead statuses that count as closed for duplicate detection. */
async function closedStatusKeys(): Promise<string[]> {
  const rows = await db.lookupValue.findMany({
    where: { listKey: "lead_status", systemKey: { in: ["WON", "LOST"] } },
    select: { key: true },
  });
  return rows.map((r) => r.key);
}

async function newStatusKey(): Promise<string> {
  const row = await db.lookupValue.findFirst({ where: { listKey: "lead_status", systemKey: "NEW" } });
  return row?.key ?? "new";
}

/** Staff who should hear about new leads: the default assignee and everyone who can assign leads. */
async function leadRecipients(assigneeId: string | null): Promise<string[]> {
  const assigners = await db.user.findMany({
    where: {
      active: true,
      roles: { some: { role: { permissions: { some: { permissionKey: "leads.assign" } } } } },
    },
    select: { id: true },
  });
  return [...new Set([...(assigneeId ? [assigneeId] : []), ...assigners.map((u) => u.id)])];
}

/**
 * Turns a website enquiry into a lead (MASTER_PROMPT §7):
 * reference, NEW status, source/UTM/referrer/locale, consent record, activity
 * log and staff notifications — all in one transaction. A repeat enquiry from
 * the same phone within the configured window updates the open lead instead.
 * Never creates a booking.
 */
export async function createLeadFromEnquiry(input: EnquiryInput, context: EnquiryContext): Promise<EnquiryResult> {
  const now = context.now ?? new Date();
  const [settings, closed, statusKey] = await Promise.all([getSettings("enquiry"), closedStatusKeys(), newStatusKey()]);

  const hall = input.preferredHallSlug
    ? await db.hall.findFirst({ where: { slug: input.preferredHallSlug, published: true }, select: { id: true } })
    : null;
  const preferredDate = input.preferredDate ? new Date(`${input.preferredDate}T00:00:00Z`) : null;
  const utm = Object.keys(context.attribution.utm).length
    ? (context.attribution.utm as Prisma.InputJsonValue)
    : undefined;
  const details = {
    eventTypeKey: input.eventTypeKey,
    preferredDate: input.preferredDate ?? null,
    guestsApprox: input.guestsApprox ?? null,
    message: input.message ?? null,
    preferredHallId: hall?.id ?? null,
    email: input.email ?? null,
    contactPreference: input.contactPreference,
  };

  const result = await db.$transaction(async (tx) => {
    const windowStart = new Date(now.getTime() - settings.duplicateWindowDays * 24 * 60 * 60 * 1000);
    const existing =
      settings.duplicateWindowDays > 0
        ? await tx.lead.findFirst({
            where: {
              phone: input.phone,
              deletedAt: null,
              statusKey: { notIn: closed },
              createdAt: { gte: windowStart },
            },
            orderBy: { createdAt: "desc" },
          })
        : null;

    let leadId: string;
    let reference: string;
    let merged = false;
    let assigneeId: string | null;

    if (existing) {
      merged = true;
      leadId = existing.id;
      reference = existing.reference;
      assigneeId = existing.assignedToId;
      await tx.lead.update({
        where: { id: existing.id },
        data: {
          lastActivityAt: now,
          // Fill gaps only; never overwrite what staff have already recorded.
          email: existing.email ?? details.email,
          eventTypeKey: existing.eventTypeKey ?? details.eventTypeKey,
          preferredDate: existing.preferredDate ?? preferredDate,
          guestsApprox: existing.guestsApprox ?? details.guestsApprox,
          preferredHallId: existing.preferredHallId ?? details.preferredHallId,
        },
      });
      await tx.leadActivity.create({
        data: {
          leadId,
          kind: "MERGED_ENQUIRY",
          note: input.message ?? null,
          data: { ...details, fullName: input.fullName, source: context.sourceKey, page: context.pagePath } as Prisma.InputJsonValue,
        },
      });
    } else {
      reference = await nextLeadReference(tx, now);
      assigneeId = settings.defaultAssigneeId;
      if (assigneeId) {
        const active = await tx.user.findFirst({ where: { id: assigneeId, active: true }, select: { id: true } });
        if (!active) assigneeId = null;
      }
      const lead = await tx.lead.create({
        data: {
          reference,
          statusKey,
          sourceKey: context.sourceKey,
          campaign: context.attribution.utm.campaign ?? null,
          utm,
          referrer: context.attribution.referrer,
          landingPage: context.attribution.landingPage,
          locale: context.locale,
          eventTypeKey: details.eventTypeKey,
          preferredDate,
          guestsApprox: details.guestsApprox,
          message: details.message,
          preferredHallId: details.preferredHallId,
          fullName: input.fullName,
          phone: input.phone,
          email: details.email,
          contactPreference: details.contactPreference,
          assignedToId: assigneeId,
          lastActivityAt: now,
          createdAt: now,
        },
      });
      leadId = lead.id;
      await tx.leadActivity.create({
        data: { leadId, kind: "CREATED", data: { source: context.sourceKey, page: context.pagePath } },
      });
    }

    await tx.consentRecord.create({
      data: {
        subjectType: "LEAD",
        subjectId: leadId,
        purpose: "contact",
        granted: true,
        noticeVersion: settings.consentNoticeVersion,
        source: context.sourceKey,
      },
    });

    await tx.conversionEvent.create({
      data: { type: "enquiry_submitted", page: context.pagePath, locale: context.locale, utm },
    });

    const recipients = await leadRecipients(assigneeId);
    const title = merged ? `Repeat enquiry ${reference}` : `New enquiry ${reference}`;
    await notifyStaff(tx, {
      userIds: recipients,
      kind: merged ? "lead.repeat_enquiry" : "lead.created",
      title,
      body: `${input.fullName} (${maskPhone(input.phone)}) — ${input.eventTypeKey}`,
      link: `/admin/leads/${leadId}`,
      // The email says where to look; customer details stay inside the CRM.
      email: {
        subject: `${title} — The Sundaram Palace`,
        text: `${title} was received from the website.\n\nOpen the CRM to see the details and respond: ${env().NEXT_PUBLIC_SITE_URL}/admin/leads/${leadId}`,
      },
      related: { type: "lead", id: leadId },
    });

    return { reference, leadId, merged };
  });

  return result;
}
