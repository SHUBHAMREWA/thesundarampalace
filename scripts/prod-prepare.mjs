// Prepares a staging or production database. Nothing else:
//
//   npm run db:prod -- --env-file .env.production
//   npm run db:prod -- --env-file .env.staging --yes      (CI / no prompt)
//
// 1. applies committed migrations (prisma migrate deploy — never reset/push)
// 2. seeds reference data only: permissions, roles, default lists, settings
//    and CMS page structure. Idempotent; never touches existing content and
//    never creates the local test admin (APP_ENV must be staging/production).
// 3. shows the final migration status
//
// It does NOT read your local .env: pass the target's env file or set the
// variables in the shell, so it can't run against the wrong database.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

import dotenv from "dotenv";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const envFileIndex = args.indexOf("--env-file");
const envFile = envFileIndex >= 0 ? args[envFileIndex + 1] : undefined;

function fail(message) {
  console.error(`\n\x1b[31m✖ ${message}\x1b[0m`);
  process.exit(1);
}

if (envFile) {
  if (!existsSync(envFile)) fail(`Env file not found: ${envFile}`);
  Object.assign(process.env, dotenv.parse(readFileSync(envFile)));
}

const appEnv = process.env.APP_ENV;
if (appEnv !== "production" && appEnv !== "staging") {
  fail(
    'APP_ENV must be "staging" or "production". Pass the target\'s variables with --env-file <file> ' +
      "(e.g. a git-ignored .env.production) — your local .env is deliberately ignored.",
  );
}
const directUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!directUrl) fail("DIRECT_DATABASE_URL (or DATABASE_URL) is not set.");

let target;
try {
  const url = new URL(directUrl);
  target = { host: url.hostname, database: url.pathname.replace(/^\//, "") };
} catch {
  fail("DIRECT_DATABASE_URL is not a valid PostgreSQL URL.");
}
if (["localhost", "127.0.0.1"].includes(target.host)) {
  fail(`APP_ENV is "${appEnv}" but the database is on ${target.host}. Check the env file.`);
}

console.log(`\nTarget: ${appEnv.toUpperCase()} database "${target.database}" on ${target.host}`);
console.log("This applies pending migrations and seeds reference data. It never deletes data.");

if (appEnv === "production") {
  console.log("\n\x1b[33mBefore continuing, confirm a fresh backup exists:\x1b[0m");
  console.log("  • a Neon restore point within the last few hours, and");
  console.log("  • last night's encrypted dump (GitHub Actions → Nightly database backup).");
}

if (!yes) {
  if (!process.stdin.isTTY) fail("No terminal to confirm in. Re-run with --yes once you've checked the target.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nType the database name (${target.database}) to continue: `);
  rl.close();
  if (answer.trim() !== target.database) fail("Cancelled — nothing was changed.");
}

const env = { ...process.env, DATABASE_URL: directUrl, DIRECT_DATABASE_URL: directUrl };
/** Runs a fixed command line, streaming its output. */
function run(label, commandLine) {
  console.log(`\n\x1b[35m▶ ${label}\x1b[0m`);
  const result = spawnSync(commandLine, { stdio: "inherit", shell: true, env });
  if (result.status !== 0) fail(`${label} failed (exit code ${result.status}). Nothing after this step was run.`);
}

run("Applying migrations", "npx prisma migrate deploy");
run("Seeding reference data", "npx tsx prisma/seed.ts");
run("Checking migration status", "npx prisma migrate status");

console.log(`\n\x1b[32m✔ ${appEnv} database is ready.\x1b[0m Deploy or rebuild the app now so static pages pick up the data.`);
