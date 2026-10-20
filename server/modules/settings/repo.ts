import "server-only"

import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm"

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

const DISABLED = sql`'{"disabled":true}'::jsonb`

/**
 * Kill switch (pnpm custom-code:off): sets `disabled` on the customCode
 * draft and published value (an unpublished or non-object value is left
 * as is), bumps the version so an open editor gets a conflict instead of
 * overwriting it, and clears updatedBy (no actor). False when there is no
 * customCode row.
 */
export async function disableCustomCode(
  db: DbOrTx,
  now: Date
): Promise<boolean> {
  const updated = await db
    .update(settings)
    .set({
      draft: sql`CASE WHEN jsonb_typeof(${settings.draft}) = 'object' THEN ${settings.draft} || ${DISABLED} ELSE ${settings.draft} END`,
      published: sql`CASE WHEN jsonb_typeof(${settings.published}) = 'object' THEN ${settings.published} || ${DISABLED} ELSE ${settings.published} END`,
      version: sql`${settings.version} + 1`,
      updatedBy: null,
      updatedAt: now,
    })
    .where(eq(settings.key, "customCode"))
    .returning({ key: settings.key })
  return updated.length > 0
}
