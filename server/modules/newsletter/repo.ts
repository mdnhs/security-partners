import "server-only"

import {
  and,
  count,
  desc,
  eq,
  ilike,
  isNull,
  lt,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm"

import type { NewsletterStatus } from "@/lib/schemas/api/newsletter"
import type { DbOrTx } from "@/server/db/client"
import { containsPattern } from "@/server/db/like"
import { newsletterSubscribers } from "@/server/db/schema"

export type SubscriberRow = typeof newsletterSubscribers.$inferSelect

type SignupMeta = {
  sourcePath: string
  consentText: string
  ipHash: string | null
}

/** A confirmed row is never touched by a new signup (anti-enumeration, no re-mail). */
const notConfirmed = ne(newsletterSubscribers.status, "confirmed")

/**
 * New address → pending row; pending or unsubscribed → back to pending with
 * the new token (unsubscribed_at stays as history, confirmed_at is cleared).
 * Returns null — so no mail goes out — when the row is confirmed, or is
 * pending and was last mailed after `resendAfter` (resend cooldown: the
 * earlier link stays valid).
 */
export async function upsertPending(
  db: DbOrTx,
  email: string,
  pending: SignupMeta & {
    tokenHash: string
    tokenExpiresAt: Date
    now: Date
    resendAfter: Date
  }
): Promise<{ id: string } | null> {
  const { now, resendAfter, ...rest } = pending
  const values = {
    status: "pending" as const,
    confirmedAt: null,
    updatedAt: now,
    ...rest,
  }
  const [row] = await db
    .insert(newsletterSubscribers)
    .values({ email, createdAt: now, ...values })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: values,
      setWhere: and(
        notConfirmed,
        sql`not (${newsletterSubscribers.status} = 'pending' and ${newsletterSubscribers.updatedAt} > ${resendAfter.toISOString()})`
      ),
    })
    .returning({ id: newsletterSubscribers.id })
  return row ?? null
}

/** Double opt-in off: straight to confirmed (an already confirmed row is left alone). */
export async function upsertConfirmed(
  db: DbOrTx,
  email: string,
  meta: SignupMeta & { now: Date }
): Promise<void> {
  const { now, ...rest } = meta
  const values = {
    status: "confirmed" as const,
    confirmedAt: now,
    tokenHash: null,
    tokenExpiresAt: null,
    updatedAt: now,
    ...rest,
  }
  await db
    .insert(newsletterSubscribers)
    .values({ email, createdAt: now, ...values })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: values,
      setWhere: notConfirmed,
    })
}

/**
 * Single use: the hash is cleared on success. Expired or unknown → false, row
 * untouched. The IP hash is only abuse evidence for the pending window, so
 * it is dropped on confirm.
 */
export async function confirmByTokenHash(
  db: DbOrTx,
  tokenHash: string,
  now: Date
): Promise<boolean> {
  const rows = await db
    .update(newsletterSubscribers)
    .set({
      status: "confirmed",
      confirmedAt: now,
      tokenHash: null,
      tokenExpiresAt: null,
      ipHash: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(newsletterSubscribers.tokenHash, tokenHash),
        eq(newsletterSubscribers.status, "pending"),
        sql`${newsletterSubscribers.tokenExpiresAt} > ${now.toISOString()}`
      )
    )
    .returning({ id: newsletterSubscribers.id })
  return rows.length > 0
}

export async function markUnsubscribed(
  db: DbOrTx,
  id: string,
  now: Date
): Promise<void> {
  await db
    .update(newsletterSubscribers)
    .set({
      status: "unsubscribed",
      unsubscribedAt: now,
      tokenHash: null,
      tokenExpiresAt: null,
      ipHash: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(newsletterSubscribers.id, id),
        ne(newsletterSubscribers.status, "unsubscribed")
      )
    )
}

export type SubscriberFilters = { status?: NewsletterStatus; q?: string }

function where(filters: SubscriberFilters): SQL | undefined {
  const parts: SQL[] = []
  if (filters.status)
    parts.push(eq(newsletterSubscribers.status, filters.status))
  if (filters.q)
    parts.push(ilike(newsletterSubscribers.email, containsPattern(filters.q)))
  return parts.length ? and(...parts) : undefined
}

export async function listSubscriberRows(
  db: DbOrTx,
  opts: { filters: SubscriberFilters; page: number; pageSize: number }
): Promise<{ rows: SubscriberRow[]; total: number }> {
  const condition = where(opts.filters)
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(newsletterSubscribers)
      .where(condition)
      .orderBy(
        desc(newsletterSubscribers.createdAt),
        desc(newsletterSubscribers.id)
      )
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db.select({ total: count() }).from(newsletterSubscribers).where(condition),
  ])
  return { rows, total }
}

export function exportSubscriberRows(
  db: DbOrTx,
  status: "all" | "confirmed"
): Promise<SubscriberRow[]> {
  return db
    .select()
    .from(newsletterSubscribers)
    .where(where({ status: status === "all" ? undefined : "confirmed" }))
    .orderBy(
      desc(newsletterSubscribers.createdAt),
      desc(newsletterSubscribers.id)
    )
}

export async function deleteSubscriberRow(
  db: DbOrTx,
  id: string
): Promise<boolean> {
  const rows = await db
    .delete(newsletterSubscribers)
    .where(eq(newsletterSubscribers.id, id))
    .returning({ id: newsletterSubscribers.id })
  return rows.length > 0
}

/**
 * Pending rows created before `cutoff` whose latest link was also issued
 * before it (issued = token_expires_at − `tokenTtlMs`). A row re-pended after
 * an unsubscribe keeps its old created_at; the issued-at check keeps its
 * fresh link alive.
 */
export async function deletePendingBefore(
  db: DbOrTx,
  cutoff: Date,
  tokenTtlMs: number
): Promise<number> {
  const issuedCutoff = new Date(cutoff.getTime() + tokenTtlMs)
  const rows = await db
    .delete(newsletterSubscribers)
    .where(
      and(
        eq(newsletterSubscribers.status, "pending"),
        lt(newsletterSubscribers.createdAt, cutoff),
        or(
          isNull(newsletterSubscribers.tokenExpiresAt),
          lt(newsletterSubscribers.tokenExpiresAt, issuedCutoff)
        )
      )
    )
    .returning({ id: newsletterSubscribers.id })
  return rows.length
}

export async function countConfirmed(
  db: DbOrTx,
  since: Date
): Promise<{ confirmed: number; since30d: number }> {
  const [row] = await db
    .select({
      confirmed: count(),
      since30d: sql<number>`count(*) filter (where ${newsletterSubscribers.confirmedAt} >= ${since.toISOString()})`,
    })
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.status, "confirmed"))
  return { confirmed: row.confirmed, since30d: Number(row.since30d) }
}

export async function findByEmail(
  db: DbOrTx,
  email: string
): Promise<SubscriberRow | null> {
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
  return row ?? null
}

export async function deleteByEmail(
  db: DbOrTx,
  email: string
): Promise<string[]> {
  const rows = await db
    .delete(newsletterSubscribers)
    .where(eq(newsletterSubscribers.email, email))
    .returning({ id: newsletterSubscribers.id })
  return rows.map((r) => r.id)
}
