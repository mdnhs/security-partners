import "server-only"

import { asc, inArray, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import {
  articleCategories,
  clients,
  groupCompanies,
  services,
  teamMembers,
} from "@/server/db/schema"

const TABLES = {
  services,
  team: teamMembers,
  clients,
  "group-companies": groupCompanies,
  categories: articleCategories,
} as const
export type ReorderTable = keyof typeof TABLES

/** Current ids in display order. */
export async function orderedIds(
  db: DbOrTx,
  name: ReorderTable
): Promise<string[]> {
  const table = TABLES[name] as (typeof TABLES)["team"]
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .orderBy(asc(table.sortOrder), asc(table.id))
  return rows.map((r) => r.id)
}

/**
 * sortOrder = position in `ids` (caller's transaction). The rows are locked
 * in id order first, then written by one statement: two editors saving
 * different orders of the same collection queue up instead of locking rows
 * in opposite orders (deadlock → 500).
 */
export async function applyOrder(
  db: DbOrTx,
  name: ReorderTable,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return
  const table = TABLES[name] as (typeof TABLES)["team"]
  await db
    .select({ id: table.id })
    .from(table)
    .where(inArray(table.id, ids))
    .orderBy(asc(table.id))
    .for("update")
  const positions = sql.join(
    ids.map((id, index) => sql`(${id}::uuid, ${index}::integer)`),
    sql`, `
  )
  await db.execute(
    sql`update ${table} set sort_order = o.position, updated_at = now() from (values ${positions}) as o(id, position) where ${table.id} = o.id`
  )
}
