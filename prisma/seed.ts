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
  if (existing) return;
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

async function main() {
  await syncAccess(db);
  await seedLookups(db);
  await seedSettings(db);
  await seedCms(db);
  await seedLocalAdmin();
  console.log("Seed complete");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
