import "server-only";

import { db } from "@/lib/db";
import { isPermissionKey, type PermissionKey } from "@/lib/permissions/registry";

export class UnauthenticatedError extends Error {
  constructor() {
    super("Sign in required");
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(readonly permission: PermissionKey) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export type UserAccess = {
  roles: string[];
  permissions: ReadonlySet<PermissionKey>;
  requires2fa: boolean;
};

/** Roles and effective permissions from a user's roles (as loaded with their permissions). */
export function accessFromRoles(
  roles: { key: string; requires2fa: boolean; permissions: { permissionKey: string }[] }[],
): UserAccess {
  const permissions = new Set<PermissionKey>();
  for (const role of roles) {
    for (const { permissionKey } of role.permissions) {
      if (isPermissionKey(permissionKey)) permissions.add(permissionKey);
    }
  }
  return {
    roles: roles.map((r) => r.key),
    permissions,
    requires2fa: roles.some((r) => r.requires2fa),
  };
}

/** Roles and effective permissions for a user, read from the database. */
export async function loadUserAccess(userId: string): Promise<UserAccess> {
  const rows = await db.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          key: true,
          requires2fa: true,
          permissions: { select: { permissionKey: true } },
        },
      },
    },
  });
  return accessFromRoles(rows.map((r) => r.role));
}

export type Actor = { id: string; permissions: ReadonlySet<PermissionKey> };

export function can(actor: Actor | null | undefined, permission: PermissionKey): boolean {
  return !!actor && actor.permissions.has(permission);
}

/** Throws unless the actor holds the permission. Call in every protected action. */
export function assertPermission(
  actor: Actor | null | undefined,
  permission: PermissionKey,
): asserts actor is Actor {
  if (!actor) throw new UnauthenticatedError();
  if (!actor.permissions.has(permission)) throw new ForbiddenError(permission);
}
