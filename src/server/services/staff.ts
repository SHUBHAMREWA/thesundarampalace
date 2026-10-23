import "server-only";

import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

import { db } from "@/lib/db";
import { ROLES, type RoleKey } from "@/lib/permissions/registry";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";

import { recordAudit } from "./audit";

/**
 * Staff accounts (invite-only sign-in). Admins with `users.manage` create
 * accounts with a temporary password; only `roles.manage` (Super Admin) can
 * grant the Super Admin or Admin roles.
 */

const PRIVILEGED: RoleKey[] = ["super_admin", "admin"];

export const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Enter the staff member's name").max(120),
  email: z.email("Enter a valid email").trim().toLowerCase(),
  roleKey: z.enum(ROLES.map((r) => r.key) as [RoleKey, ...RoleKey[]], { error: "Choose a role" }),
  temporaryPassword: z.string().min(12, "At least 12 characters").max(128),
});

function assertCanGrant(actor: Actor, roleKey: RoleKey) {
  assertPermission(actor, "users.manage");
  if (PRIVILEGED.includes(roleKey)) assertPermission(actor, "roles.manage");
}

export async function createStaff(actor: Actor, input: z.infer<typeof createStaffSchema>) {
  assertCanGrant(actor, input.roleKey);
  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new z.ZodError([{ code: "custom", path: ["email"], message: "A staff account with this email already exists", input: input.email }]);
  }
  const role = await db.role.findUniqueOrThrow({ where: { key: input.roleKey } });
  const password = await hashPassword(input.temporaryPassword);
  const user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { name: input.name, email: input.email, emailVerified: true } });
    await tx.account.create({
      data: { userId: created.id, accountId: created.id, providerId: "credential", password },
    });
    await tx.userRole.create({ data: { userId: created.id, roleId: role.id } });
    return created;
  });
  await recordAudit({
    actorId: actor.id,
    action: "user.created",
    entityType: "user",
    entityId: user.id,
    summary: { email: user.email, role: input.roleKey },
  });
  return user;
}

export async function setStaffRole(actor: Actor, userId: string, roleKey: RoleKey) {
  assertCanGrant(actor, roleKey);
  if (userId === actor.id) {
    throw new z.ZodError([{ code: "custom", path: ["roleKey"], message: "You can't change your own role", input: roleKey }]);
  }
  const current = await db.userRole.findMany({ where: { userId }, include: { role: true } });
  if (current.some((r) => PRIVILEGED.includes(r.role.key as RoleKey))) assertPermission(actor, "roles.manage");
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  await db.$transaction([
    db.userRole.deleteMany({ where: { userId } }),
    db.userRole.create({ data: { userId, roleId: role.id } }),
    // Privileges changed: end existing sessions so the new role applies at next sign-in.
    db.session.deleteMany({ where: { userId } }),
  ]);
  await recordAudit({
    actorId: actor.id,
    action: "user.role_changed",
    entityType: "user",
    entityId: userId,
    summary: { from: current.map((r) => r.role.key), to: roleKey },
  });
}

export async function setStaffActive(actor: Actor, userId: string, active: boolean) {
  assertPermission(actor, "users.manage");
  if (userId === actor.id) {
    throw new z.ZodError([{ code: "custom", path: ["form"], message: "You can't deactivate your own account", input: active }]);
  }
  const roles = await db.userRole.findMany({ where: { userId }, include: { role: true } });
  if (roles.some((r) => PRIVILEGED.includes(r.role.key as RoleKey))) assertPermission(actor, "roles.manage");
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { active } }),
    ...(active ? [] : [db.session.deleteMany({ where: { userId } })]),
  ]);
  await recordAudit({
    actorId: actor.id,
    action: active ? "user.reactivated" : "user.deactivated",
    entityType: "user",
    entityId: userId,
  });
}

export async function listStaff(actor: Actor) {
  assertPermission(actor, "users.manage");
  return db.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      active: true,
      twoFactorEnabled: true,
      lastLoginAt: true,
      roles: { select: { role: { select: { key: true, name: true } } } },
    },
  });
}

export function grantableRoles(actor: Actor) {
  return ROLES.filter((r) => !PRIVILEGED.includes(r.key) || can(actor, "roles.manage"));
}
