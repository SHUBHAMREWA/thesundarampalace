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
import net from "node:net";
import path from "node:path";

const PORT = Number(process.env.LOCAL_PG_PORT ?? 54329);

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

if (await portInUse(PORT)) {
  console.log(`Local PostgreSQL is already running on port ${PORT} — nothing to do.`);
  console.log("You can go straight to: npm run dev");
  process.exit(0);
}
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

try {
  if (isNew) {
    console.log("Initialising local PostgreSQL in .local/pgdata …");
    await pg.initialise();
  }
  await pg.start();
} catch (error) {
  console.error("Could not start the local PostgreSQL server.");
  console.error(error instanceof Error ? error.message : (error ?? "No details were reported."));
  console.error("If a previous run crashed, delete .local/pgdata/postmaster.pid and try again.");
  process.exit(1);
}

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
