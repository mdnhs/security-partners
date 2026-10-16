import "server-only"

import { and, asc, eq, getTableColumns } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { pages, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"

export async function findPageByKey(db: DbOrTx, key: string) {
  const [row] = await db.select().from(pages).where(eq(pages.key, key))
  return row ?? null
}

const withEditor = {
  ...getTableColumns(pages),
  updatedByName: users.name,
}

/** A page row plus the name of whoever changed it last (admin editor). */
export async function findPageForEdit(db: DbOrTx, key: string) {
  const [row] = await db
    .select(withEditor)
    .from(pages)
    .leftJoin(users, eq(users.id, pages.updatedBy))
    .where(eq(pages.key, key))
  return row ?? null
}

export type PageEditRow = NonNullable<
  Awaited<ReturnType<typeof findPageForEdit>>
>

export function listPagesForEdit(db: DbOrTx) {
  return db
    .select(withEditor)
    .from(pages)
    .leftJoin(users, eq(users.id, pages.updatedBy))
    .orderBy(asc(pages.key))
}

/** Optimistic-lock update: only when `version` is current; null otherwise. */
export async function updatePageIfVersion(
  db: DbOrTx,
  key: string,
  version: number,
  patch: VersionedPatch<unknown>
): Promise<PageEditRow | null> {
  const [updated] = await db
    .update(pages)
    .set({ ...patch, version: version + 1 })
    .where(and(eq(pages.key, key), eq(pages.version, version)))
    .returning({ key: pages.key })
  return updated ? findPageForEdit(db, key) : null
}
