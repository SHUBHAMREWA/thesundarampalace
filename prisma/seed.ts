/**
 * Seed: permissions, roles, default lists and settings (safe to re-run in any
 * environment), plus a local Super Admin in development only.
 * Never put real customer data here (db-change-safety skill).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedCms, seedLookups, seedSettings, syncAccess } from "./seed-lib";

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function seedLocalAdmin() {
  const appEnv = process.env.APP_ENV ?? "development";
  if (appEnv !== "development") return;
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password || password.includes("change-me")) {
    console.log("Skipping local admin: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env");
    return;
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    const account = await db.account.findFirst({
      where: { userId: existing.id, providerId: "credential" },
    });
    const hashedPassword = await hashPassword(password);
    if (account) {
      await db.account.update({
        where: { id: account.id },
        data: { password: hashedPassword },
      });
    } else {
      await db.account.create({
        data: {
          userId: existing.id,
          accountId: existing.id,
          providerId: "credential",
          password: hashedPassword,
        },
      });
    }
    console.log(`Synchronized Super Admin password for ${email} from .env.`);
    return;
  }
  const user = await db.user.create({
    data: { name: "Local Super Admin", email, emailVerified: true },
  });
  await db.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: await hashPassword(password),
    },
  });
  const role = await db.role.findUniqueOrThrow({ where: { key: "super_admin" } });
  await db.userRole.create({ data: { userId: user.id, roleId: role.id } });
  console.log(`Created local Super Admin ${email} (password from .env). 2FA setup is required on first sign-in.`);
}

/**
 * Staging/production: creates the first Super Admin from FIRST_ADMIN_EMAIL,
 * FIRST_ADMIN_PASSWORD (12+ characters) and optional FIRST_ADMIN_NAME in the
 * target's env file (npm run db:prod). Only while there is no Super Admin
 * yet: it never changes an existing account. Remove the password from the
 * env file afterwards. (Different names from SEED_ADMIN_*, so the local .env
 * can never create a production account.)
 */
async function seedFirstAdmin() {
  const appEnv = process.env.APP_ENV ?? "development";
  if (appEnv !== "staging" && appEnv !== "production") return;
  const email = process.env.FIRST_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.FIRST_ADMIN_PASSWORD;
  if (!email || !password) return;
  const role = await db.role.findUniqueOrThrow({ where: { key: "super_admin" } });
  if (await db.userRole.count({ where: { roleId: role.id } })) {
    console.log("First admin: a Super Admin already exists — nothing changed. Remove FIRST_ADMIN_* from the env file.");
    return;
  }
  if (password.length < 12) throw new Error("FIRST_ADMIN_PASSWORD needs at least 12 characters.");
  if (await db.user.findUnique({ where: { email } })) throw new Error(`${email} already has an account.`);
  const hashed = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: process.env.FIRST_ADMIN_NAME?.trim() || "Super Admin", email, emailVerified: true },
    });
    await tx.account.create({
      data: { userId: user.id, accountId: user.id, providerId: "credential", password: hashed },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await tx.auditLog.create({
      data: {
        action: "staff.created",
        entityType: "user",
        entityId: user.id,
        summary: { email, role: "super_admin", via: "seed FIRST_ADMIN_*" },
      },
    });
  });
  console.log(`Created the first Super Admin ${email}. Now remove FIRST_ADMIN_PASSWORD from the env file.`);
}

async function main() {
  await syncAccess(db);
  await seedLookups(db);
  await seedSettings(db);
  await seedCms(db);
  await seedLocalAdmin();
  await seedFirstAdmin();
  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
