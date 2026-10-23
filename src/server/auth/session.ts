import "server-only";

import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";

import { auth } from "@/lib/auth/server";
import { db } from "@/lib/db";
import type { PermissionKey } from "@/lib/permissions/registry";
import { loadUserAccess, type Actor } from "@/server/policies/authorize";

export type CurrentUser = Actor & {
  name: string;
  email: string;
  twoFactorEnabled: boolean;
  roles: string[];
  requires2fa: boolean;
};

/** The signed-in staff member, or null. Reads the request, so call it inside <Suspense>. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, active: true, twoFactorEnabled: true },
  });
  if (!user || !user.active) return null;
  const access = await loadUserAccess(user.id);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    twoFactorEnabled: user.twoFactorEnabled,
    roles: access.roles,
    permissions: access.permissions,
    requires2fa: access.requires2fa,
  };
}

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

/** For CRM pages that need a specific permission: renders the 403 page otherwise. */
export async function requirePermission(permission: PermissionKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.permissions.has(permission)) forbidden();
  return user;
}
