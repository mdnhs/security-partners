import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  or,
  sql,
} from "drizzle-orm"

import type { Sort } from "@/lib/schemas/api/list"
import type { DbOrTx } from "@/server/db/client"
import { containsPattern } from "@/server/db/like"
import { articles, builderPages, redirects, services } from "@/server/db/schema"

export type RedirectRow = typeof redirects.$inferSelect
type RedirectValues = {
  fromPath: string
  toPath: string
  code: number
  note: string
  isActive: boolean
}

export async function listRedirectRows(
  db: DbOrTx,
  opts: {
    q?: string
    sort: Sort<"fromPath" | "hits" | "updatedAt">
    page: number
    pageSize: number
  }
) {
  const pattern = opts.q ? containsPattern(opts.q) : null
  const where = pattern
    ? or(ilike(redirects.fromPath, pattern), ilike(redirects.toPath, pattern))
    : undefined
  const [{ total }] = await db
    .select({ total: count() })
    .from(redirects)
    .where(where)
  const column =
    opts.sort.field === "fromPath"
      ? redirects.fromPath
      : opts.sort.field === "hits"
        ? redirects.hits
        : redirects.updatedAt
  const rows = await db
    .select()
    .from(redirects)
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      asc(redirects.fromPath)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}

/** Every redirect by from_path (CSV export and import; the table stays small). */
export async function listAllRedirectRows(db: DbOrTx): Promise<RedirectRow[]> {
  return db.select().from(redirects).orderBy(asc(redirects.fromPath))
}

/** Rows per INSERT / UPDATE statement of an import (parameters stay well under 65k). */
const IMPORT_CHUNK = 500

/**
 * CSV import (inside the caller's locked transaction), one statement per
 * 500 rows: new rows are inserted; existing ones (matched by from_path)
 * get the given target, code, note and On/Off. Both become source
 * 'import'. `edited` false (only On/Off changed) keeps updated_at, as a
 * manual toggle does.
 */
export async function writeImportedRedirects(
  db: DbOrTx,
  creates: readonly RedirectValues[],
  updates: readonly (RedirectValues & { edited: boolean })[]
): Promise<void> {
  for (let i = 0; i < creates.length; i += IMPORT_CHUNK)
    await db
      .insert(redirects)
      .values(
        creates
          .slice(i, i + IMPORT_CHUNK)
          .map((v) => ({ ...v, source: "import" as const }))
      )
  for (let i = 0; i < updates.length; i += IMPORT_CHUNK) {
    const values = sql.join(
      updates
        .slice(i, i + IMPORT_CHUNK)
        .map(
          (v) =>
            sql`(${v.fromPath}::text, ${v.toPath}::text, ${v.code}::integer, ${v.note}::text, ${v.isActive}::boolean, ${v.edited}::boolean)`
        ),
      sql`, `
    )
    await db.execute(sql`
      update ${redirects} set
        to_path = v.to_path,
        code = v.code,
        note = v.note,
        is_active = v.is_active,
        source = 'import',
        updated_at = case when v.edited then now() else ${redirects.updatedAt} end
      from (values ${values}) as v(from_path, to_path, code, note, is_active, edited)
      where ${redirects.fromPath} = v.from_path`)
  }
}

/**
 * The slugs among `slugs` that a published service/article/builder page
 * uses (their pages are live): one query per kind for a whole import.
 */
export async function listPublishedSlugs(
  db: DbOrTx,
  kind: keyof typeof SLUG_TABLES,
  slugs: readonly string[]
): Promise<Set<string>> {
  if (slugs.length === 0) return new Set()
  const table = SLUG_TABLES[kind]
  const rows = await db
    .select({ slug: table.slug })
    .from(table)
    .where(and(inArray(table.slug, [...slugs]), isNotNull(table.published)))
  return new Set(rows.map((r) => r.slug))
}

export async function findRedirectById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(redirects).where(eq(redirects.id, id))
  return row ?? null
}

/** proxy.ts: the active redirect for one exact path, if any (Off ones never resolve). */
export async function findRedirectByFrom(db: DbOrTx, fromPath: string) {
  const [row] = await db
    .select({
      id: redirects.id,
      toPath: redirects.toPath,
      code: redirects.code,
    })
    .from(redirects)
    .where(and(eq(redirects.fromPath, fromPath), eq(redirects.isActive, true)))
  return row ?? null
}

/**
 * Every from_path → to_path (loop detection; the table stays small). Off
 * redirects count too, so turning one back on can never close a loop or
 * exceed the hop limit, and moves re-point them like the others.
 */
export async function listRedirectEdges(
  db: DbOrTx
): Promise<Map<string, string>> {
  const rows = await db
    .select({ fromPath: redirects.fromPath, toPath: redirects.toPath })
    .from(redirects)
  return new Map(rows.map((r) => [r.fromPath, r.toPath]))
}

export async function insertRedirect(db: DbOrTx, values: RedirectValues) {
  const [row] = await db.insert(redirects).values(values).returning()
  return row
}

/** `updatedAt` given → kept as is (an On/Off toggle is not an edit). */
export async function updateRedirectRow(
  db: DbOrTx,
  id: string,
  values: RedirectValues & { updatedAt?: Date }
) {
  const [row] = await db
    .update(redirects)
    .set(values)
    .where(eq(redirects.id, id))
    .returning()
  return row ?? null
}

export async function deleteRedirectRow(db: DbOrTx, id: string) {
  const [row] = await db
    .delete(redirects)
    .where(eq(redirects.id, id))
    .returning()
  return row ?? null
}

/**
 * `by` more hits (coalesced in resolve.ts) and last_hit_at = now();
 * updatedAt keeps meaning "last edited". Nothing about the visitor is stored.
 */
export async function incrementRedirectHits(
  db: DbOrTx,
  id: string,
  by = 1
): Promise<void> {
  await db
    .update(redirects)
    .set({
      hits: sql`${redirects.hits} + ${by}`,
      lastHitAt: sql`now()`,
      updatedAt: sql`${redirects.updatedAt}`,
    })
    .where(eq(redirects.id, id))
}

/** Serialises redirect writes (loop checks read the whole table). */
export async function lockRedirects(db: DbOrTx): Promise<void> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext('sp:redirects'))`)
}

const SLUG_TABLES = {
  service: services,
  article: articles,
  builder: builderPages,
} as const

/** True when a published service/article/builder page uses `slug` (its page is live). */
export async function isPublishedSlug(
  db: DbOrTx,
  kind: keyof typeof SLUG_TABLES,
  slug: string
): Promise<boolean> {
  const table = SLUG_TABLES[kind]
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.slug, slug), isNotNull(table.published)))
    .limit(1)
  return rows.length > 0
}

/**
 * A live address moved from `from` to `to`: nothing may redirect away from
 * the new address, the redirects named in `repoint` (those that led to the
 * old one) follow it, and the old address gets a 301 (taking over any
 * redirect already there, see below). Returns the source
 * paths deleted and re-pointed (for the audit).
 */
export async function moveRedirects(
  db: DbOrTx,
  from: string,
  to: string,
  repoint: readonly string[]
): Promise<{ deleted: string[]; repointed: string[] }> {
  const deleted = await db
    .delete(redirects)
    .where(eq(redirects.fromPath, to))
    .returning({ fromPath: redirects.fromPath })
  const repointed =
    repoint.length > 0
      ? await db
          .update(redirects)
          .set({ toPath: to })
          .where(inArray(redirects.fromPath, [...repoint]))
          .returning({ fromPath: redirects.fromPath })
      : []
  // Any redirect already at the old address is taken over, because the
  // move must answer there: an Off leftover (allowed while it was a live
  // page) or a manual/imported one alike becomes this automatic, active
  // 301 (source 'auto', is_active true); its note stays.
  await db
    .insert(redirects)
    .values({ fromPath: from, toPath: to, code: 301, source: "auto" })
    .onConflictDoUpdate({
      target: redirects.fromPath,
      set: {
        toPath: to,
        code: 301,
        source: "auto",
        isActive: true,
        updatedAt: new Date(),
      },
    })
  return {
    deleted: deleted.map((r) => r.fromPath),
    repointed: repointed.map((r) => r.fromPath).sort(),
  }
}
