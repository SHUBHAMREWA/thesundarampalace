import "server-only";

import { z } from "zod";

/** A business rule stopped the action; the message is safe to show staff. */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}

/** Throws a Zod-style field error so forms show it next to the field. */
export function fieldError(path: string, message: string): never {
  throw new z.ZodError([{ code: "custom", path: path.split("."), message, input: undefined }]);
}

/** PostgreSQL error raised by our append-only / immutability triggers. */
export function isImmutableRowError(error: unknown): boolean {
  return pgCode(error) === "42501";
}

/** PostgreSQL exclusion-constraint violation (two confirmed bookings overlapping). */
export function isExclusionViolation(error: unknown): boolean {
  return pgCode(error) === "23P01";
}

export function isUniqueViolation(error: unknown): boolean {
  return pgCode(error) === "23505" || (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002");
}

/**
 * Finds the PostgreSQL SQLSTATE in a Prisma error. With the pg driver adapter
 * it sits at `meta.driverAdapterError.cause.code`; Prisma's own codes (P2xxx)
 * are skipped.
 */
function pgCode(error: unknown, depth = 0): string | undefined {
  if (!error || typeof error !== "object" || depth > 5) return undefined;
  const e = error as Record<string, unknown>;
  for (const key of ["originalCode", "code"]) {
    const value = e[key];
    if (typeof value === "string" && /^[0-9A-Z]{5}$/.test(value) && !/^P\d{4}$/.test(value)) return value;
  }
  for (const key of ["meta", "driverAdapterError", "cause"]) {
    const found = pgCode(e[key], depth + 1);
    if (found) return found;
  }
  return undefined;
}
