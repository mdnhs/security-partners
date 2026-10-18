import "server-only"

import { asc, count, desc, eq, ilike, max, or, type SQL } from "drizzle-orm"

import type { Sort } from "@/lib/schemas/api/list"
import type { DbOrTx } from "@/server/db/client"
import { containsPattern } from "@/server/db/like"
import {
  articleCategories,
  articles,
  clients,
  groupCompanies,
  teamMembers,
} from "@/server/db/schema"

export function listCategoryRows(db: DbOrTx) {
  return db
    .select()
    .from(articleCategories)
    .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.name))
}

export function listTeamRows(db: DbOrTx) {
  return db
    .select()
    .from(teamMembers)
    .orderBy(asc(teamMembers.sortOrder), asc(teamMembers.name))
}

export function listClientRows(db: DbOrTx) {
  return db
    .select()
    .from(clients)
    .orderBy(asc(clients.sortOrder), asc(clients.name))
}

export function listGroupCompanyRows(db: DbOrTx) {
  return db
    .select()
    .from(groupCompanies)
    .orderBy(asc(groupCompanies.sortOrder), asc(groupCompanies.name))
}

/** The four small-collection tables, keyed by API name. */
export const COLLECTION_TABLES = {
  team: teamMembers,
  clients,
  "group-companies": groupCompanies,
  categories: articleCategories,
} as const
export type CollectionTable =
  (typeof COLLECTION_TABLES)[keyof typeof COLLECTION_TABLES]
type Name = keyof typeof COLLECTION_TABLES
export type CollectionRow<N extends Name> =
  (typeof COLLECTION_TABLES)[N]["$inferSelect"]
export type CollectionInsert<N extends Name> =
  (typeof COLLECTION_TABLES)[N]["$inferInsert"]

function searchWhere(name: Name, q: string | undefined): SQL | undefined {
  if (!q) return undefined
  const p = containsPattern(q)
  switch (name) {
    case "team":
      return or(
        ilike(teamMembers.name, p),
        ilike(teamMembers.role, p),
        ilike(teamMembers.email, p)
      )
    case "clients":
      return ilike(clients.name, p)
    case "group-companies":
      return or(ilike(groupCompanies.name, p), ilike(groupCompanies.site, p))
    case "categories":
      return or(
        ilike(articleCategories.name, p),
        ilike(articleCategories.slug, p)
      )
  }
}

/** Admin list of one collection: search, sort, paginate. */
export async function listCollectionPage<N extends Name>(
  db: DbOrTx,
  name: N,
  opts: {
    q?: string
    sort: Sort<"sortOrder" | "name" | "updatedAt">
    page: number
    pageSize: number
  }
): Promise<{ rows: CollectionRow<N>[]; total: number }> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  const where = searchWhere(name, opts.q)
  const [{ total }] = await db
    .select({ total: count() })
    .from(table)
    .where(where)
  const column = table[opts.sort.field]
  const rows = await db
    .select()
    .from(table)
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      asc(table.id)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows: rows as CollectionRow<N>[], total }
}

export async function findCollectionRow<N extends Name>(
  db: DbOrTx,
  name: N,
  id: string
): Promise<CollectionRow<N> | null> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  const [row] = await db.select().from(table).where(eq(table.id, id))
  return (row as CollectionRow<N> | undefined) ?? null
}

export async function nextCollectionSortOrder(
  db: DbOrTx,
  name: Name
): Promise<number> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  const [row] = await db.select({ top: max(table.sortOrder) }).from(table)
  return (row?.top ?? -1) + 1
}

export async function insertCollectionRow<N extends Name>(
  db: DbOrTx,
  name: N,
  values: CollectionInsert<N>
): Promise<CollectionRow<N>> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  const [row] = await db
    .insert(table)
    .values(values as never)
    .returning()
  return row as CollectionRow<N>
}

export async function updateCollectionRow<N extends Name>(
  db: DbOrTx,
  name: N,
  id: string,
  values: Partial<CollectionInsert<N>>
): Promise<CollectionRow<N> | null> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  const [row] = await db
    .update(table)
    .set(values as never)
    .where(eq(table.id, id))
    .returning()
  return (row as CollectionRow<N> | undefined) ?? null
}

export async function deleteCollectionRow(
  db: DbOrTx,
  name: Name,
  id: string
): Promise<void> {
  const table = COLLECTION_TABLES[name] as CollectionTable
  await db.delete(table).where(eq(table.id, id))
}

/** Articles per category (blocks deleting a category in use). */
export async function countArticlesInCategory(
  db: DbOrTx,
  categoryId: string
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(articles)
    .where(eq(articles.categoryId, categoryId))
  return row?.n ?? 0
}

export async function articleCountsByCategory(
  db: DbOrTx
): Promise<Map<string, number>> {
  const rows = await db
    .select({ categoryId: articles.categoryId, n: count() })
    .from(articles)
    .groupBy(articles.categoryId)
  return new Map(rows.map((r) => [r.categoryId, r.n]))
}
