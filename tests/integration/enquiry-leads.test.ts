import { afterAll, beforeAll, expect, it } from "vitest";

import { db } from "@/lib/db";
import { ALL_PERMISSIONS, ROLES, type PermissionKey } from "@/lib/permissions/registry";
import { enquirySchema } from "@/lib/validation/enquiry";
import { ForbiddenError, type Actor } from "@/server/policies/authorize";
import { createLeadFromEnquiry } from "@/server/services/enquiry";
import {
  addLeadActivity,
  assignLead,
  changeLeadStatus,
  getLead,
  listLeads,
  leadListQuerySchema,
  NotFoundError,
  updateLeadDetails,
  leadDetailsSchema,
  statusChangeSchema,
} from "@/server/services/leads";
import { deliverPendingOutbox } from "@/server/services/notifications";

import { seedLookups, seedSettings, syncAccess } from "../../prisma/seed-lib";
import { describeDb } from "./helpers";

function actorWith(id: string, permissions: PermissionKey[]): Actor {
  return { id, permissions: new Set(permissions) };
}
const roleActor = (id: string, key: string) => actorWith(id, [...(ROLES.find((r) => r.key === key)!.permissions as PermissionKey[])]);

const context = {
  locale: "en",
  sourceKey: "website_form",
  pagePath: "/en/plan-your-event",
  attribution: { utm: { source: "google", medium: "cpc", campaign: "winter-weddings" }, referrer: "https://www.google.com/", landingPage: "/en" },
};

const enquiry = (phone: string, extra: Record<string, unknown> = {}) =>
  enquirySchema.parse({
    eventTypeKey: "wedding",
    fullName: "Test Customer 01",
    phone,
    contactPreference: "whatsapp",
    consent: true,
    guestsApprox: "300",
    ...extra,
  });

let managerId = "";
let salesId = "";
let otherSalesId = "";

describeDb("enquiries become leads (tests #1, #3, #4)", () => {
  beforeAll(async () => {
    await syncAccess(db);
    await seedLookups(db);
    await seedSettings(db);
    const manager = await db.user.create({ data: { name: "Lead Manager", email: "lead-manager@example.test" } });
    const sales = await db.user.create({ data: { name: "Lead Sales", email: "lead-sales@example.test" } });
    const otherSales = await db.user.create({ data: { name: "Other Sales", email: "lead-sales-2@example.test" } });
    const managerRole = await db.role.findUniqueOrThrow({ where: { key: "manager" } });
    const salesRole = await db.role.findUniqueOrThrow({ where: { key: "sales" } });
    await db.userRole.createMany({
      data: [
        { userId: manager.id, roleId: managerRole.id },
        { userId: sales.id, roleId: salesRole.id },
        { userId: otherSales.id, roleId: salesRole.id },
      ],
    });
    managerId = manager.id;
    salesId = sales.id;
    otherSalesId = otherSales.id;
  });

  afterAll(() => db.$disconnect());

  it("creates a lead with reference, NEW status, UTM, consent, activity and notifications", async () => {
    const result = await createLeadFromEnquiry(enquiry("+919000000001"), context);
    expect(result.merged).toBe(false);
    expect(result.reference).toMatch(/^SP-L-\d{4}-\d{5}$/);

    const lead = await db.lead.findUniqueOrThrow({ where: { id: result.leadId } });
    expect(lead.statusKey).toBe("new");
    expect(lead.sourceKey).toBe("website_form");
    expect(lead.campaign).toBe("winter-weddings");
    expect(lead.utm).toEqual({ source: "google", medium: "cpc", campaign: "winter-weddings" });
    expect(lead.referrer).toBe("https://www.google.com/");
    expect(lead.guestsApprox).toBe(300);

    const consent = await db.consentRecord.findFirstOrThrow({ where: { subjectType: "LEAD", subjectId: lead.id } });
    expect(consent).toMatchObject({ purpose: "contact", granted: true, noticeVersion: "2026-10-draft" });
    expect(await db.leadActivity.count({ where: { leadId: lead.id, kind: "CREATED" } })).toBe(1);
    expect(await db.conversionEvent.count({ where: { type: "enquiry_submitted" } })).toBeGreaterThan(0);

    // Managers can assign leads, so they are alerted (in-app always).
    const notification = await db.notification.findFirstOrThrow({ where: { userId: managerId } });
    expect(notification.title).toContain(result.reference);
    expect(notification.body).not.toContain("9000000001"); // phone is masked
    expect(await db.notification.count({ where: { userId: salesId } })).toBe(0);
  });

  it("records emails as NOT_SENT_NO_PROVIDER without an email provider — never as sent", async () => {
    await deliverPendingOutbox();
    const statuses = await db.outbox.groupBy({ by: ["status"], _count: true });
    expect(statuses.map((s) => s.status)).toEqual(["NOT_SENT_NO_PROVIDER"]);
  });

  it("merges a repeat enquiry from the same phone into the open lead", async () => {
    const first = await createLeadFromEnquiry(enquiry("+919000000002"), context);
    const again = await createLeadFromEnquiry(enquiry("+919000000002", { message: "Second message", email: "repeat@example.test" }), context);
    expect(again).toMatchObject({ merged: true, leadId: first.leadId, reference: first.reference });
    expect(await db.lead.count({ where: { phone: "+919000000002" } })).toBe(1);
    const lead = await db.lead.findUniqueOrThrow({ where: { id: first.leadId } });
    expect(lead.email).toBe("repeat@example.test");
    expect(await db.leadActivity.count({ where: { leadId: first.leadId, kind: "MERGED_ENQUIRY" } })).toBe(1);
    expect(await db.consentRecord.count({ where: { subjectId: first.leadId } })).toBe(2);
  });

  it("starts a new lead when the earlier one is closed", async () => {
    const first = await createLeadFromEnquiry(enquiry("+919000000003"), context);
    await db.lead.update({ where: { id: first.leadId }, data: { statusKey: "lost", lostReasonKey: "price" } });
    const second = await createLeadFromEnquiry(enquiry("+919000000003"), context);
    expect(second.merged).toBe(false);
    expect(second.reference).not.toBe(first.reference);
  });

  it("assigns new leads to the configured default assignee", async () => {
    await db.siteSetting.update({
      where: { key: "enquiry" },
      data: { value: { duplicateWindowDays: 30, responseTimePromise: null, defaultAssigneeId: salesId, consentNoticeVersion: "2026-10-draft" } },
    });
    const result = await createLeadFromEnquiry(enquiry("+919000000004"), context);
    const lead = await db.lead.findUniqueOrThrow({ where: { id: result.leadId } });
    expect(lead.assignedToId).toBe(salesId);
    expect(await db.notification.count({ where: { userId: salesId } })).toBe(1);
  });

  it("limits Sales to their own and unassigned leads", async () => {
    const mine = await createLeadFromEnquiry(enquiry("+919000000005"), context); // default assignee = sales
    await db.siteSetting.update({
      where: { key: "enquiry" },
      data: { value: { duplicateWindowDays: 30, responseTimePromise: null, defaultAssigneeId: otherSalesId, consentNoticeVersion: "2026-10-draft" } },
    });
    const theirs = await createLeadFromEnquiry(enquiry("+919000000006"), context);

    const sales = roleActor(salesId, "sales");
    const visible = await listLeads(sales, leadListQuerySchema.parse({}));
    const ids = visible.rows.map((r) => r.id);
    expect(ids).toContain(mine.leadId);
    expect(ids).not.toContain(theirs.leadId);
    await expect(getLead(sales, theirs.leadId)).rejects.toBeInstanceOf(NotFoundError);

    const manager = roleActor(managerId, "manager");
    const all = await listLeads(manager, leadListQuerySchema.parse({ q: "9000000006" }));
    expect(all.rows.map((r) => r.id)).toEqual([theirs.leadId]);
  });

  it("finds leads by reference and phone", async () => {
    const created = await createLeadFromEnquiry(enquiry("+919000000007", { fullName: "Searchable Person" }), context);
    const manager = roleActor(managerId, "manager");
    for (const q of [created.reference.toLowerCase(), "0000007", "searchable"]) {
      const found = await listLeads(manager, leadListQuerySchema.parse({ q }));
      expect(found.rows.map((r) => r.id)).toContain(created.leadId);
    }
  });

  it("enforces permissions and rules on lead updates", async () => {
    const created = await createLeadFromEnquiry(enquiry("+919000000008"), context);
    const sales = roleActor(salesId, "sales");
    const manager = roleActor(managerId, "manager");

    // Sales may not assign.
    await expect(assignLead(sales, created.leadId, salesId)).rejects.toBeInstanceOf(ForbiddenError);
    await assignLead(manager, created.leadId, salesId);

    // Lost needs a reason.
    await expect(changeLeadStatus(sales, created.leadId, statusChangeSchema.parse({ statusKey: "lost" }))).rejects.toThrow();
    await changeLeadStatus(sales, created.leadId, statusChangeSchema.parse({ statusKey: "lost", lostReasonKey: "price", note: "Over budget" }));
    const lead = await db.lead.findUniqueOrThrow({ where: { id: created.leadId } });
    expect(lead).toMatchObject({ statusKey: "lost", lostReasonKey: "price" });

    await addLeadActivity(sales, created.leadId, { kind: "CALL", note: "Called back" });
    const kinds = (await db.leadActivity.findMany({ where: { leadId: created.leadId } })).map((a) => a.kind);
    expect(kinds).toEqual(expect.arrayContaining(["CREATED", "ASSIGNED", "STATUS_CHANGE", "CALL"]));

    // A role without leads.edit cannot change anything.
    const printer = actorWith("menu-only-user", ["pdf.menu"]);
    await expect(addLeadActivity(printer, created.leadId, { kind: "NOTE", note: "x" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("stores follow-up times entered in India time as UTC", async () => {
    const created = await createLeadFromEnquiry(enquiry("+919000000009"), context);
    const manager = roleActor(managerId, "manager");
    await updateLeadDetails(manager, created.leadId, leadDetailsSchema.parse({ followUpAt: "2026-12-10T18:00", budgetEstimate: "250000" }));
    const lead = await db.lead.findUniqueOrThrow({ where: { id: created.leadId } });
    expect(lead.followUpAt?.toISOString()).toBe("2026-12-10T12:30:00.000Z");
    expect(lead.budgetEstimate?.toFixed(2)).toBe("250000.00");
    expect(await db.leadActivity.count({ where: { leadId: created.leadId, kind: "UPDATED" } })).toBe(1);
  });

  it("keeps every permission key known to the registry", () => {
    expect(ALL_PERMISSIONS).toContain("leads.read_all");
  });
});
