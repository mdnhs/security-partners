import "server-only"

import { and, desc, eq, max } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { revisions, users } from "@/server/db/schema"

export async function insertRevision(
  db: DbOrTx,
  row: {
    entityType: string
    entityId: string
    version: number
    data: unknown
    actorId: string | null
  }
): Promise<void> {
  await db.insert(revisions).values(row)
}

/** Next revision number of an entity without a version column (max + 1). */
export async function nextRevisionVersion(
  db: DbOrTx,
  entityType: string,
  entityId: string
): Promise<number> {
  const [row] = await db
    .select({ latest: max(revisions.version) })
    .from(revisions)
    .where(
      and(
        eq(revisions.entityType, entityType),
        eq(revisions.entityId, entityId)
      )
    )
  return (row?.latest ?? 0) + 1
}

/** Newest first, with the actor's name (history drawer). */
export function listRevisionRows(
  db: DbOrTx,
  entityType: string,
  entityId: string,
  limit = 50
) {
  return db
    .select({
      id: revisions.id,
      version: revisions.version,
      createdAt: revisions.createdAt,
      actorId: revisions.actorId,
      actorName: users.name,
    })
    .from(revisions)
    .leftJoin(users, eq(users.id, revisions.actorId))
    .where(
      and(
        eq(revisions.entityType, entityType),
        eq(revisions.entityId, entityId)
      )
    )
    .orderBy(desc(revisions.version))
    .limit(limit)
}

export async function findRevision(db: DbOrTx, id: string) {
  const [row] = await db
    .select({
      id: revisions.id,
      entityType: revisions.entityType,
      entityId: revisions.entityId,
      version: revisions.version,
      data: revisions.data,
      createdAt: revisions.createdAt,
      actorId: revisions.actorId,
      actorName: users.name,
    })
    .from(revisions)
    .leftJoin(users, eq(users.id, revisions.actorId))
    .where(eq(revisions.id, id))
  return row ?? null
}
