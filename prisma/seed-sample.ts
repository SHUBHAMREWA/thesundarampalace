/**
 * OPTIONAL sample data for local development and demos only:
 *   npm run db:seed:sample
 *
 * Creates clearly fake records — "Sample Hall A/B", "Sample tax category
 * (confirm with accountant)", "Test Customer 01", phones +91 90000 000xx —
 * and a 5-day sample wedding with 6 functions and 40 quotation lines for
 * checking screens and PDFs. None of these values are business facts.
 * Refuses to run unless APP_ENV is "development".
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { amountInWordsINR } from "../src/lib/money/words";
import { computeQuote } from "../src/lib/money/quote";
import { addDays, slotRange, todayIST } from "../src/lib/time";
import { seedCms, seedLookups, seedSettings, syncAccess } from "./seed-lib";

if ((process.env.APP_ENV ?? "development") !== "development") {
  console.error("Sample data is for local development only (APP_ENV=development).");
  process.exit(1);
}
const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  await syncAccess(db);
  await seedLookups(db);
  await seedSettings(db);
  await seedCms(db);
  if (await db.customer.findFirst({ where: { reference: "SAMPLE-C-01" } })) {
    console.log("Sample data already exists — nothing to do.");
    return;
  }
  const admin = await db.user.findFirst({ where: { roles: { some: { role: { key: "super_admin" } } } } });
  if (!admin) throw new Error("Run npm run dev (or npm run db:seed) first so the local Super Admin exists.");

  const hall = (slug: string, name: string, extra: object = {}) =>
    db.hall.upsert({
      where: { slug },
      update: {},
      create: { slug, name: { en: name }, facilities: [], eventTypeKeys: ["wedding"], setupBufferMinutes: 60, teardownBufferMinutes: 60, published: false, ...extra },
    });
  const hallA = await hall("sample-hall-a", "Sample Hall A");
  const hallB = await hall("sample-hall-b", "Sample Hall B");
  const lawn = await hall("sample-lawn", "Sample Lawn");
  const morning = await db.slotDefinition.create({ data: { name: "Sample morning", startTime: "09:00", endTime: "15:00", sortOrder: 1 } });
  const evening = await db.slotDefinition.create({ data: { name: "Sample evening", startTime: "19:00", endTime: "01:00", sortOrder: 2 } });

  const tax = (name: string, sac: string, rate: string) =>
    db.taxCategory.create({ data: { name, sacCode: sac, notes: "SAMPLE — confirm with the accountant", rates: { create: { ratePercent: rate, effectiveFrom: new Date("2020-01-01T00:00:00Z") } } } });
  const taxFood = await tax("Sample catering tax (confirm with accountant)", "996334", "5.00");
  const taxService = await tax("Sample services tax (confirm with accountant)", "998596", "18.00");

  const menu = await db.menu.create({
    data: {
      name: { en: "Sample vegetarian menu", hi: "नमूना शाकाहारी मेनू" },
      category: "veg",
      items: {
        create: [
          ...["Sample paneer starter", "Sample corn starter", "Sample kebab", "Sample chaat"].map((n, i) => ({ course: "starters", name: { en: n }, sortOrder: i })),
          ...["Sample dal", "Sample paneer curry", "Sample mixed vegetables"].map((n, i) => ({ course: "main_course", name: { en: n }, sortOrder: 10 + i })),
          { course: "breads", name: { en: "Sample naan" }, sortOrder: 20 },
          { course: "rice", name: { en: "Sample pulao" }, sortOrder: 21 },
          { course: "desserts", name: { en: "Sample gulab jamun" }, sortOrder: 30 },
        ],
      },
    },
    include: { items: true },
  });
  const menuPackage = await db.menuPackage.create({
    data: { menuId: menu.id, name: "Sample standard plate", perPlateRate: "950.00", minPlates: 100, selectionRules: [{ course: "starters", choose: 3 }], taxCategoryId: taxFood.id },
  });
  const services = await Promise.all(
    [
      ["Sample hall rental", "venue_rental", "event", "150000.00"],
      ["Sample décor set-up", "decoration", "event", "85000.00"],
      ["Sample lighting and sound", "lighting_sound", "event", "40000.00"],
      ["Sample DJ (per hour)", "other", "hour", "6000.00"],
    ].map(([name, categoryKey, unit, price], i) =>
      db.serviceItem.create({ data: { name, categoryKey, unit, defaultPrice: price, taxCategoryId: taxService.id, sortOrder: i } }),
    ),
  );
  const policy = await db.cancellationPolicy.create({
    data: { name: "Sample policy (confirm with owner)", slabs: [{ daysBeforeEventMin: 90, refundPercent: "75.00" }, { daysBeforeEventMin: 30, refundPercent: "50.00" }, { daysBeforeEventMin: 0, refundPercent: "0.00" }] },
  });

  const customer = await db.customer.create({
    data: { reference: "SAMPLE-C-01", fullName: "Test Customer 01 (राहुल परीक्षण)", mobile: "+919000000001", city: "Sample City", stateCode: "09", createdById: admin.id },
  });
  const start = addDays(todayIST(), 60);
  const booking = await db.booking.create({
    data: {
      reference: "SAMPLE-B-01",
      customerId: customer.id,
      mainEventName: "Sample five-day wedding",
      mainEventTypeKey: "wedding",
      status: "CONFIRMED",
      expectedGuests: 450,
      ownerId: admin.id,
      placeOfSupplyStateCode: "09",
      depositRequired: "50000.00",
      confirmedAt: new Date(),
      confirmedById: admin.id,
      cancellationPolicySnapshot: { id: policy.id, name: policy.name, slabs: policy.slabs as object },
      createdById: admin.id,
      parties: { create: [{ role: "BRIDE", fullName: "Test Bride (परीक्षण)", mobile: "+919000000002" }, { role: "GROOM", fullName: "Test Groom", mobile: "+919000000003" }] },
    },
  });
  const functions = [
    { name: "Haldi", type: "haldi", day: 0, hall: hallB, slot: morning, guests: 120 },
    { name: "Mehendi", type: "mehendi", day: 1, hall: hallB, slot: evening, guests: 180 },
    { name: "Sangeet", type: "sangeet", day: 2, hall: hallA, slot: evening, guests: 300 },
    { name: "Engagement", type: "engagement", day: 3, hall: hallA, slot: morning, guests: 250 },
    { name: "Wedding", type: "wedding", day: 3, hall: lawn, slot: evening, guests: 450 },
    { name: "Reception", type: "reception", day: 4, hall: hallA, slot: evening, guests: 400 },
  ];
  const starters = menu.items.filter((i) => i.course === "starters").slice(0, 3);
  const subEvents = [];
  for (const [index, f] of functions.entries()) {
    const date = addDays(start, f.day);
    const range = slotRange(date, f.slot.startTime, f.slot.endTime);
    const subEvent = await db.bookingSubEvent.create({
      data: {
        bookingId: booking.id, name: f.name, eventTypeKey: f.type, date: new Date(`${date}T00:00:00Z`), hallId: f.hall.id, slotDefinitionId: f.slot.id,
        startsAt: range.startsAt, endsAt: range.endsAt, expectedGuests: f.guests, sortOrder: (index + 1) * 10, specialInstructions: index === 4 ? "Sample: mandap facing east" : null,
        dietaryNotes: index === 2 ? "Sample: 20 Jain plates" : null,
      },
    });
    await db.slotReservation.create({
      data: {
        subEventId: subEvent.id, hallId: f.hall.id, startsAt: range.startsAt, endsAt: range.endsAt, state: "CONFIRMED",
        occupancies: { create: { physicalHallId: f.hall.id, effectiveStartsAt: new Date(range.startsAt.getTime() - 3_600_000), effectiveEndsAt: new Date(range.endsAt.getTime() + 3_600_000), state: "CONFIRMED" } },
      },
    });
    await db.subEventMenuSelection.create({
      data: {
        subEventId: subEvent.id, menuPackageId: menuPackage.id, guaranteedPlates: f.guests,
        snapshot: {
          menuName: "Sample vegetarian menu", category: "veg", packageName: menuPackage.name, perPlateRate: "950.00", minPlates: 100, taxCategoryId: taxFood.id, sacCode: "996334", taxRatePercent: "5.00",
          items: menu.items.filter((i) => i.course !== "starters" || starters.some((s) => s.id === i.id)).map((i) => ({ course: i.course, name: (i.name as { en: string }).en })),
        },
      },
    });
    subEvents.push({ ...subEvent, guests: f.guests });
  }
  await db.booking.update({ where: { id: booking.id }, data: { startDate: new Date(`${start}T00:00:00Z`), endDate: new Date(`${addDays(start, 4)}T00:00:00Z`) } });

  // 40 lines: per function — plates, hall, décor, lighting, DJ hours, 2 custom extras.
  type Line = { kind: "PLATES" | "SERVICE" | "CUSTOM"; subEventId: string; subEventLabel: string; description: string; sacCode: string; unit: string; quantity: string; unitPrice: string; discount: string; taxRatePercent: string; taxCategoryId: string };
  const lines: Line[] = [];
  for (const s of subEvents) {
    const label = `${s.name}`;
    const svc = (i: number, qty = "1", discount = "0"): Line => ({ kind: "SERVICE", subEventId: s.id, subEventLabel: label, description: services[i].name, sacCode: "998596", unit: services[i].unit, quantity: qty, unitPrice: services[i].defaultPrice!.toFixed(2), discount, taxRatePercent: "18.00", taxCategoryId: taxService.id });
    lines.push({ kind: "PLATES", subEventId: s.id, subEventLabel: label, description: "Sample standard plate", sacCode: "996334", unit: "plate", quantity: String(s.guests), unitPrice: "950.00", discount: "0", taxRatePercent: "5.00", taxCategoryId: taxFood.id });
    lines.push(svc(0), svc(1, "1", "5000"), svc(2), svc(3, "4"));
    lines.push({ kind: "CUSTOM", subEventId: s.id, subEventLabel: label, description: "Sample welcome drinks counter", sacCode: "996334", unit: "counter", quantity: "1", unitPrice: "12000.00", discount: "0", taxRatePercent: "5.00", taxCategoryId: taxFood.id });
    if (lines.length < 40) lines.push({ kind: "CUSTOM", subEventId: s.id, subEventLabel: label, description: "Sample photo booth", sacCode: "998596", unit: "event", quantity: "1", unitPrice: "15000.00", discount: "0", taxRatePercent: "18.00", taxCategoryId: taxService.id });
  }
  const totals = computeQuote(lines, { pricesIncludeTax: false, supplyType: "INTRA", bookingDiscount: "25000.00" });
  const version = await db.quotationVersion.create({
    data: {
      bookingId: booking.id, versionNumber: 1, status: "DRAFT", pricesIncludeTax: false, supplyType: "INTRA", placeOfSupplyStateCode: "09", bookingDiscount: "25000.00",
      subtotal: totals.subtotal.toFixed(2), discountTotal: totals.discountTotal.toFixed(2), taxableTotal: totals.taxableTotal.toFixed(2), cgstTotal: totals.cgstTotal.toFixed(2),
      sgstTotal: totals.sgstTotal.toFixed(2), igstTotal: totals.igstTotal.toFixed(2), taxTotal: totals.taxTotal.toFixed(2), grandTotal: totals.grandTotal.toFixed(2),
      validUntil: new Date(`${addDays(todayIST(), 15)}T00:00:00Z`), terms: "Sample terms — replace with the business's own wording.", createdById: admin.id,
      lines: {
        create: lines.map((l, i) => ({
          ...l, sortOrder: (i + 1) * 10, allocatedDiscount: totals.lines[i].allocatedDiscount.toFixed(2), taxableValue: totals.lines[i].taxableValue.toFixed(2),
          cgst: totals.lines[i].cgst.toFixed(2), sgst: totals.lines[i].sgst.toFixed(2), igst: totals.lines[i].igst.toFixed(2), lineTotal: totals.lines[i].lineTotal.toFixed(2),
        })),
      },
    },
  });
  await db.quotationVersion.update({ where: { id: version.id }, data: { status: "SENT", sentAt: new Date() } });
  await db.quotationVersion.update({ where: { id: version.id }, data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedById: admin.id } });
  await db.booking.update({ where: { id: booking.id }, data: { acceptedQuotationId: version.id } });

  const grand = totals.grandTotal;
  await db.paymentInstalment.createMany({
    data: [
      { bookingId: booking.id, label: "Sample advance", dueOn: new Date(`${todayIST()}T00:00:00Z`), amount: grand.times(0.25).toDecimalPlaces(2).toFixed(2), sortOrder: 0, createdById: admin.id },
      { bookingId: booking.id, label: "Sample second instalment", dueOn: new Date(`${addDays(start, -30)}T00:00:00Z`), amount: grand.times(0.5).toDecimalPlaces(2).toFixed(2), sortOrder: 10, createdById: admin.id },
      { bookingId: booking.id, label: "Sample balance", dueOn: new Date(`${addDays(start, -7)}T00:00:00Z`), amount: grand.minus(grand.times(0.25).toDecimalPlaces(2)).minus(grand.times(0.5).toDecimalPlaces(2)).toFixed(2), sortOrder: 20, createdById: admin.id },
    ],
  });
  const fy = (() => {
    const t = todayIST();
    const y = Number(t.slice(0, 4));
    const startYear = Number(t.slice(5, 7)) >= 4 ? y : y - 1;
    return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
  })();
  await db.ledgerEntry.create({
    data: { bookingId: booking.id, type: "PAYMENT", direction: "IN", amount: "200000.00", occurredOn: new Date(`${todayIST()}T00:00:00Z`), method: "BANK_TRANSFER", transactionRef: "SAMPLE-UTR-0001", receiptNumber: `SAMPLE-R-${fy}-00001`, recordedById: admin.id, idempotencyKey: crypto.randomUUID() },
  });
  await db.depositEntry.create({ data: { bookingId: booking.id, type: "RECEIVED", amount: "50000.00", occurredOn: new Date(`${todayIST()}T00:00:00Z`), method: "CASH", recordedById: admin.id, idempotencyKey: crypto.randomUUID() } });
  console.log(`Sample wedding ${booking.reference}: ${lines.length} lines, total ${grand.toFixed(2)} (${amountInWordsINR(grand)}).`);
  console.log("Remember: every value here is fake. Delete the local database (.local/pgdata) to start clean.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
