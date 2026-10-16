import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm"

import type { Sort } from "@/lib/schemas/api/list"
import type { DbOrTx } from "@/server/db/client"
import { auditLog, users } from "@/server/db/schema"

export type NewAuditRow = typeof auditLog.$inferInsert

export async function insertAudit(db: DbOrTx, row: NewAuditRow): Promise<void> {
  await db.insert(auditLog).values(row)
}

/** Newest row about one entity since `since` (draft-save coalescing). */
export async function findLatestEntityAudit(
  db: DbOrTx,
  entityType: string,
  entityId: string,
  since: Date
) {
  const [row] = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      actorId: auditLog.actorId,
      impersonatorId: auditLog.impersonatorId,
      diff: auditLog.diff,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityType, entityType),
        eq(auditLog.entityId, entityId),
        gte(auditLog.createdAt, since)
      )
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(1)
  return row ?? null
}

/** Rewrites the diff of one row (coalesced draft saves only; createdAt is kept). */
export async function updateAuditDiff(
  db: DbOrTx,
  id: string,
  diff: unknown
): Promise<void> {
  await db.update(auditLog).set({ diff }).where(eq(auditLog.id, id))
}

export type AuditFilters = {
  actorId?: string
  action?: string
  entityType?: string
  from?: Date
  to?: Date
  q?: string
}

export type AuditSortField = "createdAt" | "action"

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

function whereFor(filters: AuditFilters): SQL | undefined {
  const conditions: (SQL | undefined)[] = [
    filters.actorId ? eq(auditLog.actorId, filters.actorId) : undefined,
    filters.action ? eq(auditLog.action, filters.action) : undefined,
    filters.entityType
      ? eq(auditLog.entityType, filters.entityType)
      : undefined,
    filters.from ? gte(auditLog.createdAt, filters.from) : undefined,
    filters.to ? lte(auditLog.createdAt, filters.to) : undefined,
  ]
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`
    conditions.push(
      or(
        ilike(auditLog.action, pattern),
        ilike(auditLog.entityType, pattern),
        ilike(auditLog.entityId, pattern),
        ilike(users.email, pattern)
      )
    )
  }
  return and(...conditions)
}

export async function listAudit(
  db: DbOrTx,
  opts: {
    filters: AuditFilters
    sort: Sort<AuditSortField>
    page: number
    pageSize: number
  }
) {
  const where = whereFor(opts.filters)
  const [{ total }] = await db
    .select({ total: count() })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(where)
  const column =
    opts.sort.field === "action" ? auditLog.action : auditLog.createdAt
  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      actorId: auditLog.actorId,
      actorName: users.name,
      actorEmail: users.email,
      impersonatorId: auditLog.impersonatorId,
      ip: auditLog.ip,
      userAgent: auditLog.userAgent,
      diff: auditLog.diff,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      // uuid v7 ids are time-ordered: stable tiebreak for equal timestamps
      desc(auditLog.id)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}
