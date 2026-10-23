import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import { ForbiddenError, UnauthenticatedError } from "@/server/policies/authorize";
import { RuleError } from "@/server/services/errors";
import { NotFoundError } from "@/server/services/leads";

/** Turns service errors into plain HTTP responses for document/file routes. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof UnauthenticatedError) return text(401, "Sign in required.");
  if (error instanceof ForbiddenError) return text(403, "You don't have permission to open this.");
  if (error instanceof NotFoundError) return text(404, "Not found.");
  if (error instanceof RuleError) return text(409, error.message);
  if (error instanceof z.ZodError) return text(400, "The request was not valid.");
  console.error("Document route failed", error);
  return text(500, "Something went wrong.");
}

function text(status: number, message: string) {
  return new NextResponse(message, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

/** Headers for private file downloads: never cached, never sniffed, never rendered with scripts. */
export function privateFileHeaders(mimeType: string, fileName: string, disposition: "inline" | "attachment"): HeadersInit {
  return {
    "content-type": mimeType,
    "content-disposition": `${disposition}; filename="${fileName.replace(/["\\\r\n]/g, "_")}"`,
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
    "x-robots-tag": "noindex, nofollow",
    "referrer-policy": "no-referrer",
  };
}
