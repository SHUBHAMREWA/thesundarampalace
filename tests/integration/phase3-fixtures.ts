import { db } from "@/lib/db";
import { ROLES, type PermissionKey, type RoleKey } from "@/lib/permissions/registry";
import { saveSettings } from "@/server/services/settings";
import { DEFAULT_SETTINGS } from "@/lib/settings/schemas";
import { gstinCheckChar } from "@/lib/validation/gst";
import type { Actor } from "@/server/policies/authorize";

import { seedLookups, seedSettings, syncAccess } from "../../prisma/seed-lib";

/**
 * Clearly fake venue data for Phase 3 integration tests: "Sample Hall A/B",
 * a combined "Sample Grand Hall", sample slots, a sample tax category and a
 * sample menu. None of these numbers are business facts.
 */

export type Fixture = Awaited<ReturnType<typeof setupPhase3>>;

export function actorFor(id: string, role: RoleKey, extra: PermissionKey[] = []): Actor {
  const def = ROLES.find((r) => r.key === role)!;
  return { id, permissions: new Set<PermissionKey>([...def.permissions, ...extra]) };
}

let counter = 0;

export async function setupPhase3(prefix: string) {
  await syncAccess(db);
  await seedLookups(db);
  await seedSettings(db);

  const users: Record<string, string> = {};
  for (const role of ["super_admin", "manager", "sales", "accounts", "operations"] as const) {
    const user = await db.user.create({ data: { name: `${prefix} ${role}`, email: `${prefix}-${role}@example.test` } });
    const saved = await db.role.findUniqueOrThrow({ where: { key: role } });
    await db.userRole.create({ data: { userId: user.id, roleId: saved.id } });
    users[role] = user.id;
  }

  const hall = (slug: string, name: string, extra: object = {}) =>
    db.hall.create({ data: { slug: `${prefix}-${slug}`, name: { en: name }, published: true, ...extra } });
  const hallA = await hall("a", "Sample Hall A");
  const hallB = await hall("b", "Sample Hall B");
  const grand = await hall("grand", "Sample Grand Hall", { isComposite: true });
  await db.hallComposition.createMany({
    data: [
      { compositeHallId: grand.id, memberHallId: hallA.id },
      { compositeHallId: grand.id, memberHallId: hallB.id },
    ],
  });
  // Typical function times (there are no fixed slots; staff type each function's times).
  const morning = { startTime: "08:00", endTime: "15:00" };
  const evening = { startTime: "18:00", endTime: "01:00" };

  const taxFood = await db.taxCategory.create({
    data: { name: `${prefix} sample catering tax`, sacCode: "996334", rates: { create: { ratePercent: "5.00", effectiveFrom: new Date("2020-01-01T00:00:00Z") } } },
  });
  const taxHall = await db.taxCategory.create({
    data: { name: `${prefix} sample hall tax`, sacCode: "997212", rates: { create: { ratePercent: "18.00", effectiveFrom: new Date("2020-01-01T00:00:00Z") } } },
  });
  const menu = await db.menu.create({
    data: {
      name: { en: "Sample veg menu" },
      category: "veg",
      items: {
        create: [
          { course: "starters", name: { en: "Sample starter 1" }, sortOrder: 1 },
          { course: "starters", name: { en: "Sample starter 2" }, sortOrder: 2 },
          { course: "starters", name: { en: "Sample starter 3" }, sortOrder: 3 },
          { course: "main_course", name: { en: "Sample main 1" }, sortOrder: 4 },
          { course: "desserts", name: { en: "Sample dessert" }, sortOrder: 5 },
        ],
      },
    },
    include: { items: true },
  });
  const menuPackage = await db.menuPackage.create({
    data: { menuId: menu.id, name: "Sample plate", perPlateRate: "850.00", minPlates: 100, selectionRules: [{ course: "starters", choose: 2 }] },
  });
  const policy = await db.cancellationPolicy.create({
    data: { name: `${prefix} sample policy`, slabs: [{ daysBeforeEventMin: 90, refundPercent: "75.00" }, { daysBeforeEventMin: 30, refundPercent: "50.00" }, { daysBeforeEventMin: 0, refundPercent: "0.00" }] },
  });
  await saveSettings("bookingPolicy", { ...DEFAULT_SETTINGS.bookingPolicy, defaultCancellationPolicyId: policy.id }, users.super_admin);
  await saveSettings("tax", { ...DEFAULT_SETTINGS.tax, cateringTaxCategoryId: taxFood.id }, users.super_admin);

  return { users, hallA, hallB, grand, morning, evening, taxFood, taxHall, menu, menuPackage, policy };
}

/** A fresh fake customer with a unique mobile (+91 90000 0xxxx). */
export async function makeCustomer(prefix: string, stateCode = "09") {
  counter += 1;
  const n = String(Math.floor(Math.random() * 9000) + 1000 + counter).slice(-5);
  return db.customer.create({
    data: { reference: `${prefix.toUpperCase()}-C-${counter}-${n}`, fullName: `Test Customer ${counter}`, mobile: `+9190000${n}`, stateCode },
  });
}

/** A future date "YYYY-MM-DD" n days from today (UTC calendar). */
export function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Fake (but well-formed) business details so tax invoices can be issued in tests. */
export async function setBusinessForInvoices(actorId: string) {
  const base = "09AAAAA0000A1Z";
  await saveSettings(
    "business",
    {
      ...DEFAULT_SETTINGS.business,
      legalName: "Sample Venue Legal Name (test)",
      gstin: base + gstinCheckChar(base),
      stateCode: "09",
      address: "Sample address, Sample City",
    },
    actorId,
  );
}
