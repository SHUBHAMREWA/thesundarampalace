// Runs only the local PostgreSQL server (Ctrl+C to stop). Most of the time
// `npm run dev` is easier: it starts this server for you as well.
//
//   npm run db:local
//
// Databases: sundaram_dev (npm run dev), sundaram_test (npm run test),
// sundaram_e2e (npm run test:e2e).
import { ensureLocalPostgres, LOCAL_PG_PORT, localUrl } from "./lib/local-postgres.mjs";

let server;
try {
  server = await ensureLocalPostgres();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

if (server.alreadyRunning) {
  console.log(`Local PostgreSQL is already running on port ${LOCAL_PG_PORT} — nothing to do.`);
  console.log("You can go straight to: npm run dev");
  process.exit(0);
}

console.log(`Local PostgreSQL running on port ${LOCAL_PG_PORT}`);
console.log(`DATABASE_URL=${localUrl("sundaram_dev")}`);

const stop = async () => {
  await server.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// Keep the process alive.
setInterval(() => {}, 1 << 30);
