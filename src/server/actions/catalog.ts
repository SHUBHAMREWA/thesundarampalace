"use server";

import { revalidatePath } from "next/cache";

import {
  addTaxRate,
  cancellationPolicySchema,
  hallBookingSchema,
  menuPackageSchema,
  packagePricingSchema,
  pricingRuleSchema,
  saveCancellationPolicy,
  saveMenuPackage,
  savePackagePricing,
  savePricingRule,
  saveServiceItem,
  saveSlot,
  saveTaxCategory,
  serviceItemSchema,
  slotSchema,
  taxCategorySchema,
  taxRateSchema,
  updateHallBookingRules,
} from "@/server/services/catalog";

import { currentActor, formObject, runAction, type ActionState } from "./helpers";

function refresh() {
  revalidatePath("/admin/catalog");
}

/** Rows like `slabs.0.daysBeforeEventMin` → [{ daysBeforeEventMin }], skipping empty rows. */
function rows(form: FormData, prefix: string, keys: string[]): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (let i = 0; i < 20; i++) {
    const row: Record<string, string> = {};
    for (const key of keys) {
      const value = form.get(`${prefix}.${i}.${key}`);
      if (typeof value === "string" && value.trim() !== "") row[key] = value.trim();
    }
    if (Object.keys(row).length) out.push(row);
  }
  return out;
}

export async function saveHallRulesAction(hallId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = hallBookingSchema.parse({ ...formObject(form), memberHallIds: form.getAll("memberHallIds").map(String) });
    await updateHallBookingRules(await currentActor(), hallId, input);
    refresh();
    return { message: "Hall booking rules saved." };
  });
}

export async function saveSlotAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await saveSlot(await currentActor(), id, slotSchema.parse(formObject(form)));
    refresh();
    return { message: "Slot saved." };
  });
}

export async function saveTaxCategoryAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const values = formObject(form);
    const input = taxCategorySchema.parse(values);
    const firstRate = id ? undefined : taxRateSchema.parse(values);
    await saveTaxCategory(await currentActor(), id, input, firstRate);
    refresh();
    return { message: "Tax category saved." };
  });
}

export async function addTaxRateAction(taxCategoryId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await addTaxRate(await currentActor(), taxCategoryId, taxRateSchema.parse(formObject(form)));
    refresh();
    return { message: "New rate added." };
  });
}

export async function saveServiceItemAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await saveServiceItem(await currentActor(), id, serviceItemSchema.parse(formObject(form)));
    refresh();
    return { message: "Service saved." };
  });
}

export async function saveMenuPackageAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = menuPackageSchema.parse({ ...formObject(form), selectionRules: rows(form, "rules", ["course", "choose"]) });
    await saveMenuPackage(await currentActor(), id, input);
    refresh();
    return { message: "Menu package saved." };
  });
}

export async function savePackagePricingAction(packageId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    await savePackagePricing(await currentActor(), packageId, packagePricingSchema.parse(formObject(form)));
    refresh();
    return { message: "Package pricing saved." };
  });
}

export async function savePricingRuleAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = pricingRuleSchema.parse({ ...formObject(form), weekdays: form.getAll("weekdays").map(String) });
    await savePricingRule(await currentActor(), id, input);
    refresh();
    return { message: "Pricing rule saved." };
  });
}

export async function saveCancellationPolicyAction(id: string | null, _prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const input = cancellationPolicySchema.parse({ ...formObject(form), slabs: rows(form, "slabs", ["daysBeforeEventMin", "refundPercent"]) });
    await saveCancellationPolicy(await currentActor(), id, input);
    refresh();
    return { message: "Cancellation policy saved." };
  });
}
