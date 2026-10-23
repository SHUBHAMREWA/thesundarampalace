import { getSessionCookie } from "better-auth/cookies";
import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { adminCsp } from "@/lib/security/headers";

const intl = createIntlMiddleware(routing);

const PUBLIC_ADMIN_PATHS = ["/admin/sign-in"];

/**
 * - `/admin/*`: strict nonce-based CSP, noindex, and an optimistic redirect to
 *   sign-in when there is no session cookie. Real authorization happens on the
 *   server in every page and action (src/server/auth/session.ts).
 * - Everything else: locale routing for the public website.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const isPublic = PUBLIC_ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (!isPublic && !getSessionCookie(request)) {
      return NextResponse.redirect(new URL("/admin/sign-in", request.url));
    }

    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const csp = adminCsp(nonce);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  return intl(request);
}

export const config = {
  // Skip API routes, Next.js internals and files with an extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
