import "server-only";

import { z } from "zod";

import { QuoteError } from "@/lib/money/quote";
import { getCurrentUser } from "@/server/auth/session";
import { ForbiddenError, UnauthenticatedError } from "@/server/policies/authorize";
import { isImmutableRowError, RuleError } from "@/server/services/errors";
import { NotFoundError } from "@/server/services/leads";

/** Result returned by CRM/CMS server actions to `useActionState` forms. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Changes on every submit so forms can react (toast, reset). */
  at?: number;
  redirectTo?: string;
  /** Small extra result for the form (e.g. the id of an existing duplicate). */
  data?: Record<string, string | number | boolean | null>;
  /** Non-blocking warnings to show after a successful save. */
  warnings?: string[];
};

/**
 * Runs an action body and turns the expected failures into form feedback.
 * Unexpected errors are logged and reported generically (no internals leak).
 */
export async function runAction(fn: () => Promise<Partial<ActionState> | void>): Promise<ActionState> {
  try {
    const result = await fn();
    return { ok: true, at: Date.now(), ...(result ?? {}) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of error.issues) {
        const key = issue.path.join(".") || "form";
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      // A whole-form error (path "form") has no field to highlight, so its text is the message.
      return { ok: false, at: Date.now(), message: fieldErrors.form ?? "Please check the highlighted fields.", fieldErrors };
    }
    if (error instanceof ForbiddenError) {
      return { ok: false, at: Date.now(), message: "You don't have permission to do that." };
    }
    if (error instanceof UnauthenticatedError) {
      return { ok: false, at: Date.now(), message: "Your session has ended. Please sign in again." };
    }
    if (error instanceof NotFoundError || error instanceof RuleError) {
      return { ok: false, at: Date.now(), message: error.message };
    }
    if (error instanceof QuoteError) {
      return { ok: false, at: Date.now(), message: error.lineIndex === undefined ? error.message : `Line ${error.lineIndex + 1}: ${error.message}` };
    }
    if (isImmutableRowError(error)) {
      return { ok: false, at: Date.now(), message: "That record is locked (financial history and sent quotations can't be changed). Create a new entry instead." };
    }
    if (isNextControlFlow(error)) throw error;
    console.error("Action failed", error);
    return { ok: false, at: Date.now(), message: "Something went wrong. Please try again." };
  }
}

/** redirect()/notFound() throw special errors that must propagate. */
function isNextControlFlow(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest: unknown }).digest === "string" &&
    /^(NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|NEXT_NOT_FOUND)/.test((error as { digest: string }).digest)
  );
}

/** The signed-in staff member for a server action (permission checks happen in the services). */
export async function currentActor() {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/** All string fields of a form as a plain object (for Zod parsing). */
export function formObject(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

export function text(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

export function checkbox(form: FormData, name: string): boolean {
  return form.get(name) === "on" || form.get(name) === "true";
}
