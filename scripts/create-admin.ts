// Creates the first Super Admin in a staging or production database.
//
//   npm run admin:create -- --env-file .env.neon
//
// It asks for the name, email and password in the terminal (the password is
// not shown while typing) and never prints it. It refuses when the email is
// already used, and asks before adding a second Super Admin.
// It does NOT read your local .env: pass the target's env file.
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import dotenv from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";

function fail(message: string): never {
  console.error(`\n\x1b[31m✖ ${message}\x1b[0m`);
  process.exit(1);
}

const args = process.argv.slice(2);
const envIndex = args.indexOf("--env-file");
const envFile = envIndex >= 0 ? args[envIndex + 1] : undefined;
if (!envFile) fail("Pass the target's env file: npm run admin:create -- --env-file .env.neon");
if (!existsSync(envFile)) fail(`Env file not found: ${envFile}`);
const target = dotenv.parse(readFileSync(envFile));
const url = target.DIRECT_DATABASE_URL || target.DATABASE_URL;
if (!url) fail("DIRECT_DATABASE_URL (or DATABASE_URL) is not set in the env file.");
const host = new URL(url).hostname;
if (!process.stdin.isTTY) fail("Run this in a terminal (it asks for a password).");

/** Reads a line without echoing it (for the password). */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (char: string) => {
      if (char === "\r" || char === "\n" || char === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (char === "\u0003") {
        process.stdout.write("\n");
        process.exit(1);
      } else if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  console.log(`\nTarget database: ${host}`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const name = (await rl.question("Full name: ")).trim();
  const email = (await rl.question("Email: ")).trim().toLowerCase();
  rl.close();
  if (!name) fail("Enter a name.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Enter a valid email.");
  if (await db.user.findUnique({ where: { email } })) fail(`${email} already has an account.`);

  const role = await db.role.findUnique({ where: { key: "super_admin" } });
  if (!role) fail("Roles are missing: run npm run db:prod -- --env-file <file> first.");
  const admins = await db.userRole.count({ where: { roleId: role.id } });
  if (admins > 0) {
    const rl2 = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl2.question(`There ${admins === 1 ? "is already 1 Super Admin" : `are already ${admins} Super Admins`}. Add another? (yes/no): `);
    rl2.close();
    if (answer.trim().toLowerCase() !== "yes") fail("Cancelled — nothing was changed.");
  }

  const password = await askHidden("Password (at least 12 characters, not shown): ");
  if (password.length < 12) fail("The password needs at least 12 characters.");
  const again = await askHidden("Type the password again: ");
  if (again !== password) fail("The passwords don't match.");

  const hashed = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, emailVerified: true } });
    await tx.account.create({
      data: { userId: user.id, accountId: user.id, providerId: "credential", password: hashed },
    });
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await tx.auditLog.create({
      data: {
        action: "staff.created",
        entityType: "user",
        entityId: user.id,
        summary: { email, role: "super_admin", via: "scripts/create-admin" },
      },
    });
  });
  console.log(`\n\x1b[32m✔ Super Admin created for ${email}.\x1b[0m Sign in at /admin/sign-in.`);
}

main()
  .catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
  .finally(() => db.$disconnect());
