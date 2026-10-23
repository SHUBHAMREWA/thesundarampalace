// Runs a real PostgreSQL 17 server inside the project (no Docker or system
// install needed) for local development and integration tests.
//
//   npm run db:local          start and keep running (Ctrl+C to stop)
//
// Data lives in .local/pgdata (git-ignored). Databases created:
//   sundaram_dev   for `npm run dev`
//   sundaram_test  for `npm run test` (reset by the test setup)
//   sundaram_e2e   for `npm run test:e2e` (reset by the Playwright setup)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 54329);
const dataDir = path.resolve(".local/pgdata");
const isNew = !existsSync(path.join(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  // UTF-8 is required for Hindi text; Windows would otherwise default to WIN1252.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

if (isNew) {
  console.log("Initialising local PostgreSQL in .local/pgdata …");
  await pg.initialise();
}
await pg.start();

for (const name of ["sundaram_dev", "sundaram_test", "sundaram_e2e"]) {
  try {
    await pg.createDatabase(name);
    console.log(`Created database ${name}`);
  } catch {
    // already exists
  }
}

console.log(`Local PostgreSQL running on port ${PORT}`);
console.log(
  `DATABASE_URL=postgresql://postgres:postgres@localhost:${PORT}/sundaram_dev`,
);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// Keep the process alive.
setInterval(() => {}, 1 << 30);
