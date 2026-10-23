import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Tx = Pick<PrismaClient, "activityLog">;

/** Timeline entry shown on customer and booking pages. Short, human-readable, no secrets. */
export async function recordActivity(
  entry: { entityType: "customer" | "booking"; entityId: string; actorId?: string | null; kind: string; message: string; data?: Prisma.InputJsonValue },
  tx: Tx = db,
): Promise<void> {
  await tx.activityLog.create({
    data: {
      entityType: entry.entityType,
      entityId: entry.entityId,
      actorId: entry.actorId ?? null,
      kind: entry.kind,
      message: entry.message.slice(0, 500),
      data: entry.data,
    },
  });
}

export async function activityTimeline(entityType: "customer" | "booking", entityId: string, take = 100) {
  const rows = await db.activityLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
  });
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((v): v is string => !!v))];
  const actors = actorIds.length
    ? await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const names = new Map(actors.map((a) => [a.id, a.name]));
  return rows.map((r) => ({ ...r, actorName: r.actorId ? (names.get(r.actorId) ?? "Staff") : "System" }));
}
