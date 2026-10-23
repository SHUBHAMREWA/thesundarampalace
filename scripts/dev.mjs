// One command for local development:
//
//   npm run dev
//
// 1. creates .env from .env.example (with random local secrets) if missing
// 2. starts the local PostgreSQL server (unless it's already running)
// 3. applies committed migrations       (prisma migrate deploy)
// 4. generates the Prisma client        (prisma generate)
// 5. seeds roles, lists, settings, CMS pages and the local Super Admin
// 6. starts the Next.js dev server; Ctrl+C stops everything
//
// To CREATE a new migration after editing prisma/schema.prisma use
// `npm run db:migrate -- --name <name>` (that step is interactive on purpose).
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import dotenv from "dotenv";

import { ensureLocalPostgres, LOCAL_PG_PORT, localUrl } from "./lib/local-postgres.mjs";

const STEPS = 6;
const step = (n, text) => console.log(`\n\x1b[35m[${n}/${STEPS}]\x1b[0m ${text}`);

function fail(message) {
  console.error(`\n\x1b[31m✖ ${message}\x1b[0m`);
  process.exit(1);
}

/** Runs a fixed command line, streaming its output; stops the script if it fails. */
function run(commandLine, env) {
  const result = spawnSync(commandLine, { stdio: "inherit", shell: true, env });
  if (result.status !== 0) fail(`"${commandLine}" failed (exit code ${result.status}).`);
}

// ─── 1. .env ──────────────────────────────────────────────────────────────
step(1, "Checking .env");
if (!existsSync(".env")) {
  if (!existsSync(".env.example")) fail(".env.example is missing.");
  const secret = (bytes) => randomBytes(bytes).toString("base64url");
  const content = readFileSync(".env.example", "utf8")
    .replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret(32)}`)
    .replace(/^CRON_SECRET=.*$/m, `CRON_SECRET=${secret(24)}`)
    .replace(/^SEED_ADMIN_PASSWORD=.*$/m, `SEED_ADMIN_PASSWORD=Local-${secret(9)}`);
  const extras =
    `\n# Test databases (local server)\n` +
    `TEST_DATABASE_URL=${localUrl("sundaram_test")}\n` +
    `E2E_DATABASE_URL=${localUrl("sundaram_e2e")}\n`;
  writeFileSync(".env", content + extras);
  console.log("Created .env with new random local secrets.");
} else {
  console.log(".env found.");
}
dotenv.config({ quiet: true });

const appEnv = process.env.APP_ENV ?? "development";
if (appEnv === "production" || appEnv === "staging") {
  fail(`APP_ENV is "${appEnv}". npm run dev is for local development only — use npm run db:prod for real environments.`);
}
const databaseUrl = process.env.DATABASE_URL ?? "";
let isLocalDb = false;
try {
  isLocalDb = ["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname);
} catch {
  fail("DATABASE_URL in .env is missing or invalid.");
}

// ─── 2. Database server ───────────────────────────────────────────────────
step(2, "Starting the local database");
let server = { alreadyRunning: true, stop: async () => {} };
if (isLocalDb) {
  try {
    server = await ensureLocalPostgres();
  } catch (error) {
    fail(error.message);
  }
  console.log(
    server.alreadyRunning
      ? `Already running on port ${LOCAL_PG_PORT}.`
      : `Started on port ${LOCAL_PG_PORT} (it stops when you press Ctrl+C).`,
  );
} else {
  console.log("DATABASE_URL points to a remote database (e.g. a Neon dev branch) — not starting a local server.");
}

const childEnv = { ...process.env, DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL || databaseUrl };

// ─── 3–5. Migrations, client, seed ────────────────────────────────────────
step(3, "Applying database migrations");
run("npx prisma migrate deploy", childEnv);

step(4, "Generating the Prisma client");
run("npx prisma generate", childEnv);

step(5, "Seeding roles, lists, settings and CMS pages (safe to repeat)");
run("npx tsx prisma/seed.ts", childEnv);

// ─── 6. Next.js ───────────────────────────────────────────────────────────
step(6, "Starting the website and CRM");
const portFlag = process.argv.findIndex((arg) => arg === "--port" || arg === "-p");
const port = (portFlag >= 0 && process.argv[portFlag + 1]) || process.env.PORT || "3000";
console.log(`  Website: http://localhost:${port}`);
console.log(`  CRM:     http://localhost:${port}/admin  (login from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD in .env)`);
console.log("  Press Ctrl+C to stop.\n");

// Only simple flags (e.g. --port 3001) are passed through to next dev.
const passthrough = process.argv.slice(2).filter((arg) => /^[\w=.-]+$/.test(arg));
const next = spawn(["npx next dev", ...passthrough].join(" "), { stdio: "inherit", shell: true, env: childEnv });

let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  next.kill();
  if (!server.alreadyRunning) {
    console.log("\nStopping the local database…");
    await server.stop().catch(() => {});
  }
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
next.on("exit", (code) => shutdown(code ?? 0));
