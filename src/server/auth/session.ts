import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { forbidden, redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import type { PermissionKey } from "@/lib/permissions/registry";
import { accessFromRoles, type Actor } from "@/server/policies/authorize";

export type CurrentUser = Actor & {
  name: string;
  email: string;
  twoFactorEnabled: boolean;
  roles: string[];
  requires2fa: boolean;
};

/**
 * The signed-in staff member, or null. Reads the request, so call it inside <Suspense>.
 * Loaded once per request (React `cache`): the layout, the page and its
 * sections all share it, and the user, roles and permissions come back in a
 * single query. `active` is still read from the database every request, so
 * deactivating someone takes effect immediately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      twoFactorEnabled: true,
      roles: {
        select: {
          role: {
            select: {
              key: true,
              requires2fa: true,
              permissions: { select: { permissionKey: true } },
            },
          },
        },
      },
    },
  });
  if (!user || !user.active) return null;
  const access = accessFromRoles(user.roles.map((r) => r.role));
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    twoFactorEnabled: user.twoFactorEnabled,
    roles: access.roles,
    permissions: access.permissions,
    requires2fa: access.requires2fa,
  };
});

/**
 * For CRM pages: redirects to sign-in when signed out, and to the 2FA setup
 * page when the user's role requires 2FA and it is not enabled yet.
 */
export async function requireUser(options: { allowMissing2fa?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/sign-in");
  if (user.requires2fa && !user.twoFactorEnabled && !options.allowMissing2fa) {
    redirect("/admin/security/two-factor");
  }
  return user;
}

/**
 * For route handlers: the signed-in user, or null when signed out or when
 * their role requires 2FA that isn't set up yet (they get 401 and must
 * finish setup in the CRM first).
 */
export async function getApiUser(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user || (user.requires2fa && !user.twoFactorEnabled)) return null;
  return user;
}

/** Client IP and user agent for audit entries written by route handlers. */
export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

/** For CRM pages that need a specific permission: renders the 403 page otherwise. */
export async function requirePermission(permission: PermissionKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.has(permission)) forbidden();
  return user;
}
