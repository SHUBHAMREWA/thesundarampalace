import "server-only";

import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { addDays, istToUtc } from "@/lib/time";
import { assertPermission, can, type Actor } from "@/server/policies/authorize";

import { bookingVisibility } from "./bookings";
import { leadVisibility } from "./leads";

/** Audit log viewer and global quick search (Phase 4). */

// ─── Audit log ───────────────────────────────────────────────────────────────

export const auditQuerySchema = z.object({
  action: z.string().trim().max(80).optional().catch(undefined),
  entity: z.string().trim().max(80).optional().catch(undefined),
  actor: z.string().max(50).optional().catch(undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});

export const AUDIT_PAGE_SIZE = 50;

export async function listAudit(actor: Actor, query: z.infer<typeof auditQuerySchema>) {
  assertPermission(actor, "audit.read");
  const where: Prisma.AuditLogWhereInput = {
    ...(query.action ? { action: { contains: query.action } } : {}),
    ...(query.entity ? { OR: [{ entityType: query.entity }, { entityId: query.entity }] } : {}),
    ...(query.actor ? { actorId: query.actor } : {}),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: istToUtc(query.from, "00:00") } : {}), ...(query.to ? { lt: istToUtc(addDays(query.to, 1), "00:00") } : {}) } }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((v): v is string => !!v))];
  const users = await db.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const names = new Map(users.map((u) => [u.id, u.name]));
  return { total, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)), rows: rows.map((r) => ({ ...r, actorName: r.actorId ? (names.get(r.actorId) ?? "Staff") : "System" })) };
}

// ─── Quick search ────────────────────────────────────────────────────────────

/** Name, phone or reference across what the user may see. */
export async function quickSearch(actor: Actor, raw: string) {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return { leads: [], customers: [], bookings: [] };
  const digits = q.replace(/\D/g, "");
  const ref = q.toUpperCase();
  const [leads, customers, bookings] = await Promise.all([
    can(actor, "leads.read")
      ? db.lead.findMany({
          where: { AND: [leadVisibility(actor), { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { reference: { contains: ref } }, ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : [])] }] },
          take: 8,
          orderBy: { createdAt: "desc" },
          select: { id: true, reference: true, fullName: true },
        })
      : [],
    can(actor, "customers.read")
      ? db.customer.findMany({
          where: { deletedAt: null, OR: [{ fullName: { contains: q, mode: "insensitive" } }, { reference: { contains: ref } }, ...(digits.length >= 4 ? [{ mobile: { contains: digits } }] : [])] },
          take: 8,
          orderBy: { updatedAt: "desc" },
          select: { id: true, reference: true, fullName: true },
        })
      : [],
    can(actor, "bookings.read")
      ? db.booking.findMany({
          where: {
            AND: [
              bookingVisibility(actor),
              {
                OR: [
                  { reference: { contains: ref } },
                  { mainEventName: { contains: q, mode: "insensitive" } },
                  ...(can(actor, "customers.read") ? [{ customer: { fullName: { contains: q, mode: "insensitive" as const } } }, ...(digits.length >= 4 ? [{ customer: { mobile: { contains: digits } } }] : [])] : []),
                ],
              },
            ],
          },
          take: 8,
          orderBy: { startDate: { sort: "desc", nulls: "last" } },
          select: { id: true, reference: true, mainEventName: true, status: true },
        })
      : [],
  ]);
  return { leads, customers, bookings };
}

