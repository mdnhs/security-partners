import "server-only"

import { getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import { errorKind } from "@/server/lib/errors"
import { pgErrorCode } from "@/server/lib/pg-errors"
import {
  claimDueJobs,
  deleteClaimedJob,
  finishJob,
  releaseClaimedJob,
  upsertRecurringJob,
} from "@/server/modules/jobs/repo"

import {
  SIGNATURE_HEADER,
  signInternalRequest,
  TIMESTAMP_HEADER,
} from "./internal-signature"
import { ALL_JOBS, type JobDefinition, RECURRING_JOBS } from "./jobs"

// In-process scheduler (spec §12): a 60 s tick in every server instance;
// the jobs table (FOR UPDATE SKIP LOCKED) makes replicas safe.

export const TICK_INTERVAL_MS = 60_000
export const FIRST_TICK_DELAY_MS = 5_000
/** A claim older than this belongs to a crashed worker and may be taken over. */
export const LOCK_TIMEOUT_MS = 10 * 60_000
export const RETRY_DELAY_MS = 60_000
/** run_at of a parked job: never due until enqueueKeyedJob re-queues it. */
export const PARKED_RUN_AT = new Date("9999-12-31T00:00:00.000Z")
const CLAIM_LIMIT = 10
const ERROR_MAX_LENGTH = 2_000
const REVALIDATE_TIMEOUT_MS = 10_000

export type TickResult = {
  name: string
  key: string | null
  ok: boolean
  error: string | null
  tags: string[]
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Cache tags a previous run of this job could not expire. */
function pendingTagsOf(payload: unknown): string[] {
  const tags = isRecord(payload) ? payload.pendingTags : undefined
  return Array.isArray(tags)
    ? tags.filter((t): t is string => typeof t === "string")
    : []
}

/** The payload with `pendingTags` set to `tags` (removed when empty; null when nothing is left). */
function withPendingTags(payload: unknown, tags: string[]): unknown {
  if (!isRecord(payload) && payload !== null && tags.length === 0)
    return payload
  const rest: Record<string, unknown> = isRecord(payload) ? { ...payload } : {}
  delete rest.pendingTags
  if (tags.length > 0) rest.pendingTags = tags
  return Object.keys(rest).length > 0 ? rest : null
}

/** The payload with `parked` set (or left as is when the run did not park). */
function withParked(
  payload: unknown,
  park: Record<string, unknown> | undefined
): unknown {
  if (!park) return payload
  return { ...(isRecord(payload) ? payload : {}), parked: park }
}

/**
 * jobs.last_error for a failed run: a database error is logged by code only
 * and stored as fixed text (raw driver messages carry SQL and parameters).
 */
function failureText(job: string, err: unknown): string {
  if (pgErrorCode(err) === undefined) return message(err)
  console.error(`[scheduler] ${job}: database error ${errorKind(err)}`)
  return "Database error while running the job"
}

/** Inserts missing recurring job rows; existing rows keep their schedule. */
export async function ensureRecurringJobs(
  now = new Date(),
  definitions: readonly JobDefinition[] = RECURRING_JOBS
): Promise<void> {
  const db = getDb()
  for (const job of definitions)
    await upsertRecurringJob(db, { name: job.name, key: job.key, runAt: now })
}

/** Our own origin for server-to-itself calls (PORT is set by next start / server.js). */
export function internalOrigin(): string {
  return `http://127.0.0.1:${process.env.PORT ?? "3000"}`
}

/**
 * Expires cache tags through the signed internal route: revalidateTag
 * throws outside a request (ledger ruling, notes §2).
 */
export async function revalidateViaApi(tags: string[]): Promise<void> {
  const body = JSON.stringify({ tags })
  const { timestamp, signature } = signInternalRequest(body)
  const res = await fetch(`${internalOrigin()}/api/v1/internal/revalidate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [TIMESTAMP_HEADER]: timestamp,
      [SIGNATURE_HEADER]: signature,
    },
    body,
    // A hung request must not stall the tick (ticks never overlap).
    signal: AbortSignal.timeout(REVALIDATE_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Cache refresh answered ${res.status}`)
}

/** Claims and runs the due jobs once. Options exist for tests (clock, jobs, cache). */
export async function tick(
  options: {
    now?: Date
    jobs?: readonly JobDefinition[]
    revalidate?: (tags: string[]) => Promise<void>
    /** Checked before each job: true (shutdown) releases the claims not yet started. */
    shouldStop?: () => boolean
  } = {}
): Promise<TickResult[]> {
  const now = options.now ?? new Date()
  const definitions = options.jobs ?? ALL_JOBS
  const revalidate = options.revalidate ?? revalidateViaApi
  const db = getDb()
  const claimed = await claimDueJobs(db, {
    now,
    staleBefore: new Date(now.getTime() - LOCK_TIMEOUT_MS),
    limit: CLAIM_LIMIT,
  })
  const results: TickResult[] = []
  for (const [index, job] of claimed.entries()) {
    if (options.shouldStop?.()) {
      // Shutting down: the next instance (or restart) runs these at once
      // instead of waiting LOCK_TIMEOUT_MS for a stale claim.
      for (const rest of claimed.slice(index))
        await releaseClaimedJob(db, rest.id, now)
      break
    }
    const definition = definitions.find((d) => d.name === job.name)
    let ok = true
    let done = false
    let park: Record<string, unknown> | undefined
    const notes: string[] = []
    let tags: string[] = []
    // Tags a previous run could not expire (loopback down, restart): retried
    // first, kept in the payload until a refresh succeeds — with
    // cacheLife("max") a lost refresh would otherwise hide the change.
    let unrefreshed = pendingTagsOf(job.payload)
    if (unrefreshed.length > 0)
      try {
        await revalidate(unrefreshed)
        unrefreshed = []
      } catch (err) {
        notes.push(`Cache refresh failed: ${message(err)}`)
      }
    try {
      if (!definition) throw new Error(`No handler for job "${job.name}"`)
      const result = await definition.run({ now, payload: job.payload })
      done = result.done === true
      park = result.park
      tags = result.tags ?? []
      if (result.warning) notes.unshift(result.warning)
      if (tags.length > 0) {
        if (unrefreshed.length > 0)
          unrefreshed = [...new Set([...unrefreshed, ...tags])]
        else
          try {
            await revalidate(tags)
          } catch (err) {
            unrefreshed = tags
            notes.push(`Cache refresh failed: ${message(err)}`)
          }
      }
    } catch (err) {
      ok = false
      notes.unshift(failureText(job.name, err))
    }
    const error = notes.length > 0 ? notes.join("; ") : null
    // A finished one-off job goes away, unless cache tags still wait for a
    // refresh (the row keeps them and runs again).
    if (ok && done && unrefreshed.length === 0)
      await deleteClaimedJob(db, job.id, now)
    else
      await finishJob(db, job.id, now, {
        runAt:
          ok && park
            ? PARKED_RUN_AT
            : new Date(
                now.getTime() +
                  (ok && definition ? definition.everyMs : RETRY_DELAY_MS)
              ),
        lastRunAt: now,
        lastError: error?.slice(0, ERROR_MAX_LENGTH) ?? null,
        succeeded: ok,
        payload: withParked(
          withPendingTags(job.payload, unrefreshed),
          ok ? park : undefined
        ),
      })
    results.push({ name: job.name, key: job.key, ok, error, tags })
  }
  return results
}

type SchedulerState = {
  first: NodeJS.Timeout
  interval: NodeJS.Timeout
  /** The tick in progress, if any. */
  current: Promise<void> | null
  stopped: boolean
}
// On globalThis: one scheduler per process, even across dev HMR reloads.
const store = globalThis as unknown as { __spScheduler?: SchedulerState }

/**
 * Starts the tick (spec §12). Never during `next build`, never twice per
 * process, and not at all without the app env (logged). Returns whether it
 * started.
 */
export function startScheduler(): boolean {
  if (process.env.NEXT_PHASE === "phase-production-build") return false
  if (store.__spScheduler) return false
  try {
    getEnv()
  } catch (err) {
    console.error("[scheduler] not started:", message(err))
    return false
  }
  const once = async (state: SchedulerState) => {
    try {
      await ensureRecurringJobs()
      for (const result of await tick({ shouldStop: () => state.stopped }))
        if (result.error)
          console.error(`[scheduler] ${result.name}: ${result.error}`)
    } catch (err) {
      console.error("[scheduler] tick failed:", message(err))
    } finally {
      state.current = null
    }
  }
  const run = () => {
    const state = store.__spScheduler
    // A slow tick never overlaps the next; a stopped scheduler starts none.
    if (!state || state.stopped || state.current) return
    state.current = once(state)
  }
  const first = setTimeout(run, FIRST_TICK_DELAY_MS)
  const interval = setInterval(run, TICK_INTERVAL_MS)
  first.unref?.()
  interval.unref?.()
  store.__spScheduler = { first, interval, current: null, stopped: false }
  return true
}

/**
 * Stops the tick (tests, graceful shutdown). Resolves once the tick in
 * progress, if any, has finished its running job and released the claims
 * it had not started; it never keeps the process alive by itself. The
 * store keeps the stopping state until then, so startScheduler cannot start
 * a second scheduler beside a tick that is still running. On shutdown this
 * is best effort when Next's own handler is present: Next may exit first,
 * and an unfinished claim then falls back to LOCK_TIMEOUT_MS.
 */
export async function stopScheduler(): Promise<void> {
  const state = store.__spScheduler
  if (!state) return
  clearTimeout(state.first)
  clearInterval(state.interval)
  state.stopped = true
  try {
    await state.current
  } finally {
    if (store.__spScheduler === state) store.__spScheduler = undefined
  }
}
