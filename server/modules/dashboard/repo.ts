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
  lt,
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

/**
 * Non-spam leads on the Irish calendar days `fromDay` (inclusive) to
 * `toDay` (exclusive), both "2026-09-20". Constant bounds, as above.
 */
export async function countLeadsBetweenDays(
  db: DbOrTx,
  fromDay: string,
  toDay: string
): Promise<number> {
  const from = sql`(${fromDay}::date::timestamp at time zone 'Europe/Dublin')`
  const to = sql`(${toDay}::date::timestamp at time zone 'Europe/Dublin')`
  const [row] = await db
    .select({ n: count() })
    .from(leads)
    .where(
      and(
        gte(leads.createdAt, from),
        lt(leads.createdAt, to),
        ne(leads.status, "spam")
      )
    )
  return row.n
}

/** The oldest lead still marked new (Next up's "Reply to …"). */
export async function oldestNewLead(
  db: DbOrTx
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: leads.id, name: leads.name })
    .from(leads)
    .where(eq(leads.status, "new"))
    .orderBy(asc(leads.createdAt), asc(leads.id))
    .limit(1)
  return row ?? null
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

/** Non-spam leads per calendar day in Irish time in [since, until). */
export function leadsPerDay(db: DbOrTx, since: Date, until: Date) {
  return db
    .select({ date: irishDay, n: count() })
    .from(leads)
    .where(
      and(
        gte(leads.createdAt, since),
        lt(leads.createdAt, until),
        ne(leads.status, "spam")
      )
    )
    .groupBy(irishDay)
}

/**
 * What content QA scans, each part only when asked for: the live version
 * of pages, services and the given settings keys (the draft until first
 * published). A page is "updated since the seed" once its version moved
 * past 1 (every save and publish bumps it).
 */
export async function qaSources(
  db: DbOrTx,
  want: { pages: boolean; services: boolean; settingsKeys: string[] }
) {
  const [pageRows, serviceRows, settingRows] = await Promise.all([
    want.pages
      ? db
          .select({
            key: pages.key,
            draft: pages.draft,
            published: pages.published,
            version: pages.version,
          })
          .from(pages)
          .orderBy(asc(pages.key))
      : [],
    want.services
      ? db
          .select({
            id: services.id,
            draft: services.draft,
            published: services.published,
          })
          .from(services)
          .orderBy(asc(services.sortOrder), asc(services.slug))
      : [],
    want.settingsKeys.length
      ? db
          .select({
            key: settings.key,
            draft: settings.draft,
            published: settings.published,
          })
          .from(settings)
          .where(inArray(settings.key, want.settingsKeys))
      : [],
  ])
  return {
    pages: pageRows.map((row) => ({
      key: row.key,
      data: row.published ?? row.draft,
      published: row.published !== null,
      updatedSinceSeed: row.version > 1,
    })),
    services: serviceRows.map((row) => {
      const data = row.published ?? row.draft
      return { id: row.id, title: data?.title ?? "", data }
    }),
    settings: settingRows.map((row) => ({
      key: row.key,
      data: row.published ?? row.draft,
    })),
  }
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
