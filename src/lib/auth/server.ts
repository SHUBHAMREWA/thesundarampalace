import "server-only";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { haveIBeenPwned, twoFactor } from "better-auth/plugins";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { recordAudit } from "@/server/services/audit";

const e = env();
const strict = e.APP_ENV === "staging" || e.APP_ENV === "production";

/**
 * Staff authentication (docs/architecture.md ADR-05).
 * - Email + password only; no public sign-up — admins create staff accounts.
 * - TOTP two-factor; enforced for privileged roles by the CRM layout.
 * - Database sessions, revocable; cookies HttpOnly + Secure + SameSite=Lax.
 */
export const auth = betterAuth({
  appName: "The Sundaram Palace",
  secret: e.BETTER_AUTH_SECRET,
  baseURL: e.BETTER_AUTH_URL,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // absolute: 7 days
    updateAge: 60 * 60 * 8, // refreshed at most every 8 hours of use
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 300, max: 10 },
      "/two-factor/verify-totp": { window: 300, max: 10 },
      "/two-factor/verify-backup-code": { window: 300, max: 10 },
    },
  },
  advanced: {
    useSecureCookies: strict,
    defaultCookieAttributes: { sameSite: "lax", httpOnly: true },
  },
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await db.user.update({
            where: { id: session.userId },
            data: { lastLoginAt: new Date() },
          });
          await recordAudit({
            actorId: session.userId,
            action: "auth.sign_in",
            entityType: "user",
            entityId: session.userId,
            ip: session.ipAddress,
            userAgent: session.userAgent,
          });
        },
      },
    },
  },
  plugins: [
    twoFactor({ issuer: "The Sundaram Palace" }),
    ...(strict ? [haveIBeenPwned()] : []),
    nextCookies(), // must be last
  ],
});

export type Auth = typeof auth;
