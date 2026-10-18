import "server-only"

import { migrateMediaJob } from "./migrate-media"
import { publishScheduledJob } from "./publish-scheduled"
import { pruneRevisionsJob } from "./prune-revisions"
import { purgeLeadsJob } from "./purge-leads"

export type JobContext = { now: Date; payload: unknown }
/**
 * `tags`: cache tags to expire; `warning`: recorded in jobs.last_error
 * without failing the run; `done`: one-off job finished → its row is deleted.
 */
export type JobResult = { tags?: string[]; warning?: string; done?: boolean }
export type JobDefinition = {
  name: string
  /** jobs.key: one row per recurring job. */
  key: string
  /** Next run = this long after a successful run. */
  everyMs: number
  run(ctx: JobContext): Promise<JobResult>
}

/** Spec §12 jobs owned by this phase (backup comes later). */
export const RECURRING_JOBS: readonly JobDefinition[] = [
  publishScheduledJob,
  pruneRevisionsJob,
  purgeLeadsJob,
]

/** One-off jobs queued by a request (enqueueKeyedJob); tick() runs them, ensureRecurringJobs never creates them. */
export const TRIGGERED_JOBS: readonly JobDefinition[] = [migrateMediaJob]

/** Every handler tick() can dispatch. */
export const ALL_JOBS: readonly JobDefinition[] = [
  ...RECURRING_JOBS,
  ...TRIGGERED_JOBS,
]
