import "server-only"

import {
  and,
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
  leads,
  pages,
  services,
  settings,
  users,
} from "@/server/db/schema"

const OPEN = ["new", "contacted", "qualified"] as const

const irishDay = sql<string>`to_char(${leads.createdAt} at time zone 'Europe/Dublin', 'YYYY-MM-DD')`

/** Non-spam leads created on or after the Irish calendar day `day` ("2026-09-20"). */
export async function countLeadsFromDay(
  db: DbOrTx,
  day: string
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(leads)
    .where(and(gte(irishDay, day), ne(leads.status, "spam")))
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
      .where(eq(articles.status, "published")),
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
