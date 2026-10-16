import "server-only"

import { and, eq, getTableColumns, inArray } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { settings, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"

export async function findSettingsRow(db: DbOrTx, key: string) {
  const [row] = await db.select().from(settings).where(eq(settings.key, key))
  return row ?? null
}

const withEditor = { ...getTableColumns(settings), updatedByName: users.name }

/** A settings row plus the last editor's name (admin editor). */
export async function findSettingsForEdit(db: DbOrTx, key: string) {
  const [row] = await db
    .select(withEditor)
    .from(settings)
    .leftJoin(users, eq(users.id, settings.updatedBy))
    .where(eq(settings.key, key))
  return row ?? null
}

export type SettingsEditRow = NonNullable<
  Awaited<ReturnType<typeof findSettingsForEdit>>
>

export function listSettingsForEdit(db: DbOrTx, keys: readonly string[]) {
  return db
    .select(withEditor)
    .from(settings)
    .leftJoin(users, eq(users.id, settings.updatedBy))
    .where(inArray(settings.key, [...keys]))
}

/**
 * Optimistic-lock update. settings has no status/publishedAt columns
 * (spec §5.4): only draft, published and updatedBy are written.
 */
export async function updateSettingsIfVersion(
  db: DbOrTx,
  key: string,
  version: number,
  patch: VersionedPatch<unknown>
): Promise<SettingsEditRow | null> {
  const [updated] = await db
    .update(settings)
    .set({
      ...(patch.draft !== undefined ? { draft: patch.draft } : {}),
      ...(patch.published !== undefined ? { published: patch.published } : {}),
      updatedBy: patch.updatedBy,
      version: version + 1,
    })
    .where(and(eq(settings.key, key), eq(settings.version, version)))
    .returning({ key: settings.key })
  return updated ? findSettingsForEdit(db, key) : null
}
