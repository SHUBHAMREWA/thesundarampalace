import "server-only";

import { MARITAL_STATUSES } from "@/server/services/customers";
import { lookupOptions } from "@/server/services/lookups";

export async function customerFormOptions() {
  const [categories, professions] = await Promise.all([
    lookupOptions("customer_category"),
    lookupOptions("profession"),
  ]);
  return {
    categories,
    professions,
    maritalStatuses: MARITAL_STATUSES.map((m) => ({
      value: m.value,
      label: m.label,
    })),
  };
}
