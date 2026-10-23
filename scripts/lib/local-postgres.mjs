// Embedded PostgreSQL 17 for local development and tests (no Docker or
// system install). Data lives in .local/pgdata (git-ignored).
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";

export const LOCAL_PG_PORT = Number(process.env.LOCAL_PG_PORT ?? 54329);
export const LOCAL_DATABASES = ["sundaram_dev", "sundaram_test", "sundaram_e2e"];

export function localUrl(database, port = LOCAL_PG_PORT) {
  return `postgresql://postgres:postgres@localhost:${port}/${database}`;
}

export function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

/** True when PostgreSQL on the port accepts a real query (not just a TCP connection). */
export async function postgresReady(port = LOCAL_PG_PORT) {
  const client = new pg.Client({ connectionString: localUrl("postgres", port), connectionTimeoutMillis: 2000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Starts the local server unless a working one is already on the port.
 * A server that is still starting up or shutting down is waited for (up to
 * ~15 s). Returns { alreadyRunning, stop } — stop() is a no-op if we didn't
 * start the server.
 */
export async function ensureLocalPostgres({ port = LOCAL_PG_PORT, log = console.log } = {}) {
  for (let attempt = 0; attempt < 15 && (await portInUse(port)); attempt++) {
    if (await postgresReady(port)) return { alreadyRunning: true, stop: async () => {} };
    if (attempt === 0) log(`Port ${port} is busy but PostgreSQL isn't answering yet — waiting…`);
    await wait(1000);
  }
  if (await portInUse(port)) {
    throw new Error(
      `Something on port ${port} is not answering as PostgreSQL. Close it, or set LOCAL_PG_PORT ` +
        "to another port and update DATABASE_URL in .env to match.",
    );
  }

  const dataDir = path.resolve(".local/pgdata");
  const isNew = !existsSync(path.join(dataDir, "PG_VERSION"));
  let stopping = false;
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: true,
    // UTF-8 is required for Hindi text; Windows would otherwise default to WIN1252.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    // Connections closing while we shut down are expected; report anything else.
    onError: (error) => {
      if (!stopping) console.error(error);
    },
  });

  try {
    if (isNew) {
      log("Initialising local PostgreSQL in .local/pgdata …");
      await server.initialise();
    }
    await server.start();
  } catch (error) {
    const reason = error instanceof Error ? error.message : (error ?? "No details were reported.");
    throw new Error(
      `Could not start the local PostgreSQL server: ${reason}\n` +
        "If a previous run crashed, delete .local/pgdata/postmaster.pid and try again.",
    );
  }

  for (const name of LOCAL_DATABASES) {
    try {
      await server.createDatabase(name);
      log(`Created database ${name}`);
    } catch {
      // already exists
    }
  }

  return {
    alreadyRunning: false,
    stop: async () => {
      stopping = true;
      await server.stop();
    },
  };
}
