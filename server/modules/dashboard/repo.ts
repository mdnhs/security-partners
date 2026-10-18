import "server-only"

import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  sql,
} from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import {
  articles,
  jobs,
  leads,
  pages,
  services,
  settings,
  users,
} from "@/server/db/schema"

const OPEN = ["new", "contacted", "qualified"] as const

const irishDay = sql<string>`to_char(${leads.createdAt} at time zone 'Europe/Dublin', 'YYYY-MM-DD')`

/**
 * Query: non-spam leads created on or after the Irish calendar day `day`
 * ("2026-09-20"). Compares created_at with one constant instant (midnight
 * in Dublin, computed by Postgres' own tz data), so leads_created_at_idx
 * can serve the range — never a per-row conversion (full scan).
 */
export function leadsFromDayQuery(db: DbOrTx, day: string) {
  const dublinMidnight = sql`(${day}::date::timestamp at time zone 'Europe/Dublin')`
  return db
    .select({ n: count() })
    .from(leads)
    .where(and(gte(leads.createdAt, dublinMidnight), ne(leads.status, "spam")))
}

/** Non-spam leads created on or after the Irish calendar day `day` ("2026-09-20"). */
export async function countLeadsFromDay(
  db: DbOrTx,
  day: string
): Promise<number> {
  const [row] = await leadsFromDayQuery(db, day)
  return row.n
}

export async function countOpenLeads(db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(leads)
    .where(inArray(leads.status, [...OPEN]))
  return row.n
}

export async function countUnassignedNewLeads(db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(leads)
    .where(and(eq(leads.status, "new"), isNull(leads.assigneeId)))
  return row.n
}

/** Non-spam leads per calendar day in Irish time since `since`. */
export function leadsPerDay(db: DbOrTx, since: Date) {
  return db
    .select({ date: irishDay, n: count() })
    .from(leads)
    .where(and(gte(leads.createdAt, since), ne(leads.status, "spam")))
    .groupBy(irishDay)
}

export async function publishedCounts(db: DbOrTx) {
  const [[p], [s], [a]] = await Promise.all([
    db.select({ n: count() }).from(pages).where(isNotNull(pages.published)),
    db
      .select({ n: count() })
      .from(services)
      .where(isNotNull(services.published)),
    db
      .select({ n: count() })
      .from(articles)
      // Live = has a published version, also while an update is scheduled
      // (status 'scheduled') — the same rule as pages and services.
      .where(isNotNull(articles.published)),
  ])
  return { pages: p.n, services: s.n, articles: a.n }
}

export async function countArticlesInReview(db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(articles)
    .where(eq(articles.status, "in_review"))
  return row.n
}

/** Which of `keys` have a settings row (integrations are configured once saved). */
export async function existingSettingsKeys(
  db: DbOrTx,
  keys: string[]
): Promise<Set<string>> {
  const rows = await db
    .select({ key: settings.key })
    .from(settings)
    .where(inArray(settings.key, keys))
  return new Set(rows.map((r) => r.key))
}

export async function twoFactorEnabled(
  db: DbOrTx,
  userId: string
): Promise<boolean> {
  const [row] = await db
    .select({ on: users.twoFactorEnabled })
    .from(users)
    .where(eq(users.id, userId))
  return !!row?.on
}

/** Jobs whose last run failed or warned (spec §12: surfaced on the dashboard). */
export async function listJobProblems(
  db: DbOrTx
): Promise<{ name: string; lastError: string }[]> {
  const rows = await db
    .select({ name: jobs.name, lastError: jobs.lastError })
    .from(jobs)
    .where(isNotNull(jobs.lastError))
    .orderBy(asc(jobs.name))
  return rows.map((row) => ({ name: row.name, lastError: row.lastError ?? "" }))
}
