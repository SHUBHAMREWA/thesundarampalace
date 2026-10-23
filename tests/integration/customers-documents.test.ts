import { afterAll, beforeAll, expect, it } from "vitest";

import { db } from "@/lib/db";
import { ForbiddenError } from "@/server/policies/authorize";
import { addSubEvent, changeBookingStatus, createBooking, createBookingSchema, subEventSchema } from "@/server/services/bookings";
import {
  createCustomer,
  customerSchema,
  DuplicateCustomerError,
  getCustomer,
  listMergeReviews,
  mergeCustomers,
  readCustomerDocument,
  uploadCustomerDocument,
  documentUploadSchema,
  updateCustomer,
} from "@/server/services/customers";
import { generateDocument, previewDocumentHtml, readGeneratedDocument } from "@/server/services/documents";
import { acceptVersion, addLine, createDraft, lineSchema, markSent } from "@/server/services/quotations";

import { describeDb } from "./helpers";
import { actorFor, futureDate, setupPhase3, type Fixture } from "./phase3-fixtures";

let fx: Fixture;
const P = "cd";
const manager = () => actorFor(fx.users.manager, "manager");
const sales = () => actorFor(fx.users.sales, "sales");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describeDb("customers, private documents and generated documents (Phase 3)", () => {
  beforeAll(async () => {
    fx = await setupPhase3(P);
  });
  afterAll(() => db.$disconnect());

  it("refuses a duplicate mobile unless created anyway, which opens a merge review", async () => {
    const raw = { fullName: "Test Customer Dup", mobile: "9000012345", maritalStatus: "married", dateOfBirth: "1990-05-01" };
    const input = customerSchema.parse(raw);
    const first = await createCustomer(sales(), input);
    expect(first.reference).toMatch(/^SP-C-\d{4}-\d{5}$/);
    // Sales can't see or write personal fields.
    expect(first.dateOfBirth).toBeNull();
    await expect(createCustomer(sales(), input)).rejects.toBeInstanceOf(DuplicateCustomerError);
    const second = await createCustomer(manager(), customerSchema.parse({ ...raw, fullName: "Test Customer Dup Two" }), { allowDuplicate: true });
    const reviews = await listMergeReviews(manager());
    const review = reviews.find((r) => r.duplicateId === second.id)!;
    expect(review.primary?.id).toBe(first.id);
    await expect(listMergeReviews(sales())).rejects.toBeInstanceOf(ForbiddenError);
    await mergeCustomers(manager(), review.id, first.id);
    const removed = await db.customer.findUniqueOrThrow({ where: { id: second.id } });
    expect(removed.deletedAt).not.toBeNull();
    expect(removed.mergedIntoId).toBe(first.id);
    const kept = await db.customer.findUniqueOrThrow({ where: { id: first.id } });
    expect(kept.dateOfBirth?.toISOString().slice(0, 10)).toBe("1990-05-01");
  });

  it("hides personal fields from roles without customers.personal.read", async () => {
    const created = await createCustomer(manager(), customerSchema.parse({ fullName: "Test Customer Private", mobile: "9000012399", address: "Sample street", maritalStatus: "single" }));
    const forSales = await getCustomer(sales(), created.id);
    expect("address" in forSales.customer).toBe(false);
    expect(forSales.documents).toBeNull();
    const forManager = await getCustomer(manager(), created.id);
    expect(forManager.customer.address).toBe("Sample street");
    await updateCustomer(manager(), created.id, customerSchema.parse({ fullName: "Test Customer Private", mobile: "9000012399", address: "New street" }));
    const audit = await db.auditLog.findFirst({ where: { action: "customer.updated", entityId: created.id } });
    expect(JSON.stringify(audit?.summary)).not.toContain("New street");
  });

  it("stores identity documents privately, checks content type, and audit-logs every view", async () => {
    const customer = await createCustomer(manager(), customerSchema.parse({ fullName: "Test Customer Docs", mobile: "9000012377" }));
    const input = documentUploadSchema.parse({ category: "PAN", purpose: "Invoice in the customer's company name" });
    await expect(uploadCustomerDocument(manager(), customer.id, input, { name: "evil.png", bytes: new TextEncoder().encode("<script>alert(1)</script>") })).rejects.toThrow();
    await expect(uploadCustomerDocument(sales(), customer.id, input, { name: "pan.png", bytes: PNG })).rejects.toBeInstanceOf(ForbiddenError);
    const doc = await uploadCustomerDocument(manager(), customer.id, input, { name: "../../pan card.png", bytes: PNG });
    expect(doc.fileName).toBe("pan card.png");
    expect(doc.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    await expect(readCustomerDocument(sales(), doc.id, {})).rejects.toBeInstanceOf(ForbiddenError);
    const file = await readCustomerDocument(manager(), doc.id, { ip: "203.0.113.5" });
    expect(file.mimeType).toBe("image/png");
    expect(Buffer.compare(file.bytes, Buffer.from(PNG))).toBe(0);
    const views = await db.auditLog.findMany({ where: { action: "document.viewed", entityId: doc.id } });
    expect(views).toHaveLength(1);
    expect(views[0].ip).toBe("203.0.113.5");
  });

  it("documents contain only ticked fields; kitchen sheets have no prices", async () => {
    const customer = await createCustomer(manager(), customerSchema.parse({ fullName: "Test Customer <b>Html</b>", mobile: "9000012388", address: "Secret lane", stateCode: "09" }));
    const booking = await createBooking(sales(), createBookingSchema.parse({ customerId: customer.id, mainEventName: "Sample wedding", mainEventTypeKey: "wedding", initialStatus: "TENTATIVE" }));
    await addSubEvent(sales(), booking.id, subEventSchema.parse({ name: "Wedding", eventTypeKey: "wedding", date: futureDate(15), hallId: fx.hallA.id, slotDefinitionId: fx.evening.id, specialInstructions: "Mandap facing east" }));
    const draft = await createDraft(sales(), booking.id, null);
    await addLine(sales(), draft.id, lineSchema.parse({ kind: "SERVICE", description: "Sample hall rental", unit: "event", quantity: "1", unitPrice: "125000", discount: "0", taxCategoryId: fx.taxHall.id }));

    const base = { bookingId: booking.id, type: "quotation" as const, template: "elegant" as const, sourceId: draft.id, customNote: null };
    const withAddress = await previewDocumentHtml(manager(), { ...base, fields: ["customer.name", "customer.address", "pricing.lines", "pricing.total"] });
    expect(withAddress).toContain("Secret lane");
    expect(withAddress).toContain("₹1,47,500.00");
    expect(withAddress).toContain("Test Customer &lt;b&gt;Html&lt;/b&gt;"); // escaped, never raw HTML
    expect(withAddress).toContain("DRAFT");
    const without = await previewDocumentHtml(manager(), { ...base, fields: ["customer.name", "pricing.total"] });
    expect(without).not.toContain("Secret lane");
    expect(without).not.toContain("Sample hall rental");
    // Sales may tick the address but lacks permission, so it is dropped.
    const salesView = await previewDocumentHtml(sales(), { ...base, fields: ["customer.name", "customer.address", "pricing.total"] });
    expect(salesView).not.toContain("Secret lane");

    await markSent(sales(), draft.id);
    await acceptVersion(manager(), draft.id);
    await changeBookingStatus(manager(), booking.id, { to: "CONFIRMED", reason: null, overrideReason: null });
    const kitchen = actorFor(fx.users.kitchen, "kitchen");
    const sheet = await previewDocumentHtml(kitchen, { bookingId: booking.id, type: "kitchen_sheet", template: "kitchen", fields: ["event.main", "event.functions", "notes.special", "pricing.total" as string], sourceId: null, customNote: null });
    expect(sheet).toContain("Mandap facing east");
    expect(sheet).not.toContain("₹");
    await expect(previewDocumentHtml(kitchen, { ...base, fields: ["pricing.total"] })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("generates a real PDF, records it, and serves it only to permitted users", async () => {
    const customer = await createCustomer(manager(), customerSchema.parse({ fullName: "Test Customer हिन्दी नाम", mobile: "9000012366" }));
    const booking = await createBooking(sales(), createBookingSchema.parse({ customerId: customer.id, mainEventName: "Sample wedding", mainEventTypeKey: "wedding", initialStatus: "TENTATIVE" }));
    await addSubEvent(sales(), booking.id, subEventSchema.parse({ name: "Wedding", eventTypeKey: "wedding", date: futureDate(20), hallId: fx.hallB.id, slotDefinitionId: fx.evening.id }));
    const doc = await generateDocument(manager(), { bookingId: booking.id, type: "function_sheet", template: "compact", fields: ["customer.name", "event.main", "event.functions"], sourceId: null, customNote: null });
    expect(doc.format).toBe("pdf");
    expect(doc.reference).toBe(`${booking.reference}/FS`);
    const file = await readGeneratedDocument(manager(), doc.id, {});
    expect(file.bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(file.mimeType).toBe("application/pdf");
    const accountsActor = actorFor(fx.users.accounts, "accounts");
    await expect(readGeneratedDocument(accountsActor, doc.id, {})).rejects.toBeInstanceOf(ForbiddenError);
    expect(await db.auditLog.count({ where: { action: "document.downloaded", entityId: doc.id } })).toBe(1);
  }, 60_000);
});
