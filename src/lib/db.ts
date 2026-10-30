import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

// One client per server process; reused across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  // On Neon, DATABASE_URL is the pooled (-pooler) URL. Vercel Fluid compute
  // closes idle connections before a function instance is suspended.
  const pool = new Pool({ connectionString: env().DATABASE_URL });
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
