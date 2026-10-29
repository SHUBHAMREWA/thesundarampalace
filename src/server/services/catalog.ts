import "server-only";

import { z } from "zod";

import { MENU_COURSES } from "@/lib/content/catalog";
import { percentString } from "@/lib/validation/forms";

/**
 * Readers for catalog data still stored on older records. The Services,
 * Menu packages and Cancellation policy screens were removed (owner,
 * 29 Oct 2026); the food menu is edited as one document (see ./food-menu).
 */

export const selectionRuleSchema = z.object({
  course: z.enum(MENU_COURSES),
  choose: z.coerce.number().int().min(1).max(50),
});
export type SelectionRule = z.infer<typeof selectionRuleSchema>;

export function parseSelectionRules(value: unknown): SelectionRule[] {
  const parsed = z.array(selectionRuleSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export const slabSchema = z.object({
  daysBeforeEventMin: z.coerce.number().int().min(0).max(1000),
  refundPercent: percentString,
});

export function parseSlabs(value: unknown) {
  const parsed = z.array(slabSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}
