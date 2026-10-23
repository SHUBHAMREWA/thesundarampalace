import "dotenv/config";

import { execSync } from "node:child_process";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { Client } from "pg";

import { seedCms, seedLookups, seedSettings, syncAccess } from "../../prisma/seed-lib";
import { PrismaClient } from "../../src/generated/prisma/client";
import { E2E_PASSWORD, E2E_USERS } from "./fixtures";

/** Rebuilds the e2e database and creates fake staff accounts. */
export default async function globalSetup(): Promise<void> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL is not set (see .env.example)");
  const dbName = new URL(url).pathname.replace(/^\//, "");
  if (!dbName.endsWith("_e2e")) {
    throw new Error(`Refusing to reset "${dbName}": e2e database names must end in _e2e`);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url },
  });

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    await syncAccess(db);
    await seedLookups(db);
    await seedSettings(db);
    await seedCms(db);
    const password = await hashPassword(E2E_PASSWORD);
    for (const user of Object.values(E2E_USERS)) {
      const created = await db.user.create({
        data: { name: user.name, email: user.email, emailVerified: true },
      });
      await db.account.create({
        data: { userId: created.id, accountId: created.id, providerId: "credential", password },
      });
      const role = await db.role.findUniqueOrThrow({ where: { key: user.role } });
      await db.userRole.create({ data: { userId: created.id, roleId: role.id } });
    }
  } finally {
    await db.$disconnect();
  }
}
