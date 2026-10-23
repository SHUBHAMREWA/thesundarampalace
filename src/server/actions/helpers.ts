import "server-only";

import { z } from "zod";

import { ForbiddenError, UnauthenticatedError } from "@/server/policies/authorize";
import { NotFoundError } from "@/server/services/leads";

/** Result returned by CRM/CMS server actions to `useActionState` forms. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Changes on every submit so forms can react (toast, reset). */
  at?: number;
  redirectTo?: string;
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
      return { ok: false, at: Date.now(), message: "Please check the highlighted fields.", fieldErrors };
    }
    if (error instanceof ForbiddenError) {
      return { ok: false, at: Date.now(), message: "You don't have permission to do that." };
    }
    if (error instanceof UnauthenticatedError) {
      return { ok: false, at: Date.now(), message: "Your session has ended. Please sign in again." };
    }
    if (error instanceof NotFoundError) {
      return { ok: false, at: Date.now(), message: error.message };
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

export function text(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" ? value : undefined;
}

export function checkbox(form: FormData, name: string): boolean {
  return form.get(name) === "on" || form.get(name) === "true";
}
