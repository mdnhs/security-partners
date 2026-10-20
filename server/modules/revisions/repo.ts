import "server-only"

import { and, desc, eq, max, sql } from "drizzle-orm"

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

/** Keeps the newest `keep` revisions of every entity (spec §12); returns rows deleted. */
export async function pruneRevisionRows(
  db: DbOrTx,
  keep: number
): Promise<number> {
  const result = await db.execute(sql`
    delete from ${revisions}
    where ${revisions.id} in (
      select ranked.id from (
        select ${revisions.id} as id,
          row_number() over (
            partition by ${revisions.entityType}, ${revisions.entityId}
            order by ${revisions.version} desc
          ) as position
        from ${revisions}
      ) ranked
      where ranked.position > ${keep}
    )`)
  return result.rowCount ?? 0
}
