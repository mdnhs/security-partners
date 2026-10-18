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
import { articles, redirects, services } from "@/server/db/schema"

export type RedirectRow = typeof redirects.$inferSelect
type RedirectValues = { fromPath: string; toPath: string; code: number }

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

export async function findRedirectById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(redirects).where(eq(redirects.id, id))
  return row ?? null
}

/** proxy.ts: the redirect for one exact path, if any. */
export async function findRedirectByFrom(db: DbOrTx, fromPath: string) {
  const [row] = await db
    .select({
      id: redirects.id,
      toPath: redirects.toPath,
      code: redirects.code,
    })
    .from(redirects)
    .where(eq(redirects.fromPath, fromPath))
  return row ?? null
}

/** Every from_path → to_path (loop detection; the table stays small). */
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

export async function updateRedirectRow(
  db: DbOrTx,
  id: string,
  values: RedirectValues
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

/** `by` more hits (coalesced in resolve.ts); updatedAt keeps meaning "last edited". */
export async function incrementRedirectHits(
  db: DbOrTx,
  id: string,
  by = 1
): Promise<void> {
  await db
    .update(redirects)
    .set({
      hits: sql`${redirects.hits} + ${by}`,
      updatedAt: sql`${redirects.updatedAt}`,
    })
    .where(eq(redirects.id, id))
}

/** Serialises redirect writes (loop checks read the whole table). */
export async function lockRedirects(db: DbOrTx): Promise<void> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext('sp:redirects'))`)
}

/** True when a published service/article uses `slug` (its page is live). */
export async function isPublishedSlug(
  db: DbOrTx,
  kind: "service" | "article",
  slug: string
): Promise<boolean> {
  const rows =
    kind === "service"
      ? await db
          .select({ id: services.id })
          .from(services)
          .where(and(eq(services.slug, slug), isNotNull(services.published)))
          .limit(1)
      : await db
          .select({ id: articles.id })
          .from(articles)
          .where(and(eq(articles.slug, slug), isNotNull(articles.published)))
          .limit(1)
  return rows.length > 0
}

/**
 * A live address moved from `from` to `to`: nothing may redirect away from
 * the new address, the redirects named in `repoint` (those that led to the
 * old one) follow it, and the old address gets a 301. Returns the source
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
  await db
    .insert(redirects)
    .values({ fromPath: from, toPath: to, code: 301 })
    .onConflictDoUpdate({
      target: redirects.fromPath,
      set: { toPath: to, code: 301, updatedAt: new Date() },
    })
  return {
    deleted: deleted.map((r) => r.fromPath),
    repointed: repointed.map((r) => r.fromPath).sort(),
  }
}
