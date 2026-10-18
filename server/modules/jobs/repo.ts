import "server-only"

import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { jobs } from "@/server/db/schema"

export type JobRow = typeof jobs.$inferSelect

/**
 * Keyed recurring job: inserted once; an existing row keeps its schedule,
 * lock and last error (ON CONFLICT (key) DO UPDATE refreshes the name only).
 */
export async function upsertRecurringJob(
  db: DbOrTx,
  job: { name: string; key: string; runAt: Date }
): Promise<void> {
  await db
    .insert(jobs)
    .values(job)
    .onConflictDoUpdate({ target: jobs.key, set: { name: job.name } })
}

/**
 * Claims due jobs in one statement: run_at reached and not locked (or the
 * lock is older than `staleBefore` — a crashed worker). The sub-select is
 * FOR UPDATE SKIP LOCKED, so concurrent ticks claim disjoint rows and a
 * claimed row is never claimed twice.
 */
export function claimDueJobs(
  db: DbOrTx,
  opts: { now: Date; staleBefore: Date; limit: number }
) {
  const due = db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        lte(jobs.runAt, opts.now),
        or(isNull(jobs.lockedAt), lt(jobs.lockedAt, opts.staleBefore))
      )
    )
    .orderBy(asc(jobs.runAt))
    .limit(opts.limit)
    .for("update", { skipLocked: true })
  return db
    .update(jobs)
    .set({ lockedAt: opts.now, attempts: sql`${jobs.attempts} + 1` })
    .where(inArray(jobs.id, due))
    .returning()
}

/** Releases a claimed job (only while this claim still holds it). */
export async function finishJob(
  db: DbOrTx,
  id: string,
  claimedAt: Date,
  result: {
    runAt: Date
    lastRunAt: Date
    lastError: string | null
    succeeded: boolean
    /** Replaces the payload when given (e.g. tags still to expire). */
    payload?: unknown
  }
): Promise<void> {
  await db
    .update(jobs)
    .set({
      lockedAt: null,
      runAt: result.runAt,
      lastRunAt: result.lastRunAt,
      lastError: result.lastError,
      ...(result.payload !== undefined ? { payload: result.payload } : {}),
      ...(result.succeeded ? { attempts: 0 } : {}),
    })
    .where(and(eq(jobs.id, id), eq(jobs.lockedAt, claimedAt)))
}

/**
 * Queues a keyed one-off job to run at `runAt`. A waiting row is re-queued
 * (runAt reset, last error cleared); a running row (locked) is left alone,
 * so triggering twice never runs two copies.
 */
export async function enqueueKeyedJob(
  db: DbOrTx,
  job: { name: string; key: string; runAt: Date }
): Promise<void> {
  await db
    .insert(jobs)
    .values(job)
    .onConflictDoUpdate({
      target: jobs.key,
      set: { name: job.name, runAt: job.runAt, lastError: null },
      setWhere: isNull(jobs.lockedAt),
    })
}

export async function findJobByKey(
  db: DbOrTx,
  key: string
): Promise<JobRow | null> {
  const [row] = await db.select().from(jobs).where(eq(jobs.key, key))
  return row ?? null
}

/** Removes a finished one-off job (only while this claim still holds it). */
export async function deleteClaimedJob(
  db: DbOrTx,
  id: string,
  claimedAt: Date
): Promise<void> {
  await db
    .delete(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.lockedAt, claimedAt)))
}
