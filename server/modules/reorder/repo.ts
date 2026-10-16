import "server-only"

import { asc, eq } from "drizzle-orm"

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

/** sortOrder = position in `ids` (caller's transaction). */
export async function applyOrder(
  db: DbOrTx,
  name: ReorderTable,
  ids: string[]
): Promise<void> {
  const table = TABLES[name] as (typeof TABLES)["team"]
  for (const [index, id] of ids.entries())
    await db.update(table).set({ sortOrder: index }).where(eq(table.id, id))
}
