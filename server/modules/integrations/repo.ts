import "server-only"

import { and, eq, inArray, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { settings, users } from "@/server/db/schema"

export type IntegrationRow = {
  key: string
  draft: unknown
  version: number
  updatedAt: Date
  updatedBy: string | null
  updatedByName: string | null
}

const columns = {
  key: settings.key,
  draft: settings.draft,
  version: settings.version,
  updatedAt: settings.updatedAt,
  updatedBy: settings.updatedBy,
  updatedByName: users.name,
}

export function listIntegrationRows(
  db: DbOrTx,
  keys: readonly string[]
): Promise<IntegrationRow[]> {
  return db
    .select(columns)
    .from(settings)
    .leftJoin(users, eq(users.id, settings.updatedBy))
    .where(inArray(settings.key, [...keys]))
}

/**
 * Locks the settings row (FOR UPDATE) until the transaction ends. R2
 * Disconnect takes it before counting r2 media rows, so an upload holding
 * the row FOR SHARE (media repo `lockR2Settings`) finishes first.
 */
export async function lockIntegrationRow(
  db: DbOrTx,
  key: string
): Promise<void> {
  await db
    .select({ key: settings.key })
    .from(settings)
    .where(eq(settings.key, key))
    .for("update")
}

export async function findIntegrationRow(
  db: DbOrTx,
  key: string
): Promise<IntegrationRow | null> {
  const [row] = await db
    .select(columns)
    .from(settings)
    .leftJoin(users, eq(users.id, settings.updatedBy))
    .where(eq(settings.key, key))
  return row ?? null
}

/** First save; false when another request created the row first. */
export async function insertIntegrationRow(
  db: DbOrTx,
  row: { key: string; draft: unknown; updatedBy: string | null }
): Promise<boolean> {
  const inserted = await db
    .insert(settings)
    .values({ ...row, version: 1 })
    .onConflictDoNothing({ target: settings.key })
    .returning({ key: settings.key })
  return inserted.length > 0
}

/** Optimistic update: false when `version` is stale or the row is gone. */
export async function updateIntegrationIfVersion(
  db: DbOrTx,
  key: string,
  version: number,
  patch: { draft: unknown; updatedBy: string }
): Promise<boolean> {
  const updated = await db
    .update(settings)
    .set({ ...patch, version: version + 1 })
    .where(and(eq(settings.key, key), eq(settings.version, version)))
    .returning({ key: settings.key })
  return updated.length > 0
}

export async function deleteIntegrationIfVersion(
  db: DbOrTx,
  key: string,
  version: number
): Promise<boolean> {
  const deleted = await db
    .delete(settings)
    .where(and(eq(settings.key, key), eq(settings.version, version)))
    .returning({ key: settings.key })
  return deleted.length > 0
}

/** Deletes these integrations' rows (db:sync); returns the keys that existed, sorted. */
export async function deleteIntegrationRows(
  db: DbOrTx,
  keys: readonly string[]
): Promise<string[]> {
  const deleted = await db
    .delete(settings)
    .where(inArray(settings.key, [...keys]))
    .returning({ key: settings.key })
  return deleted.map((row) => row.key).sort()
}

/** Replaces the stored object (secrets:rotate). Bumps `version` so an open form reloads. */
export async function replaceIntegrationDraft(
  db: DbOrTx,
  key: string,
  draft: unknown
): Promise<void> {
  await db
    .update(settings)
    .set({ draft, version: sql`${settings.version} + 1` })
    .where(eq(settings.key, key))
}
