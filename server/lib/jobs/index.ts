import "server-only"

import { backupJob } from "./backup"
import { deleteRetiredMediaJob } from "./delete-retired-media"
import { migrateMediaJob } from "./migrate-media"
import { publishScheduledJob } from "./publish-scheduled"
import { pruneRevisionsJob } from "./prune-revisions"
import { purgeLeadsJob } from "./purge-leads"
import { purgeNewsletterJob } from "./purge-newsletter"

export type JobContext = { now: Date; payload: unknown }
/**
 * `tags`: cache tags to expire; `warning`: recorded in jobs.last_error
 * without failing the run; `done`: one-off job finished → its row is
 * deleted; `park`: one-off job made no progress → not run again until it is
 * queued again (enqueueKeyedJob); the value is kept as payload.parked.
 */
export type JobResult = {
  tags?: string[]
  warning?: string
  done?: boolean
  park?: Record<string, unknown>
}
export type JobDefinition = {
  name: string
  /** jobs.key: one row per recurring job. */
  key: string
  /** Next run = this long after a successful run. */
  everyMs: number
  run(ctx: JobContext): Promise<JobResult>
}

/** Spec §12 recurring jobs. */
export const RECURRING_JOBS: readonly JobDefinition[] = [
  publishScheduledJob,
  pruneRevisionsJob,
  purgeLeadsJob,
  purgeNewsletterJob,
  backupJob,
]

/** One-off jobs queued by a request (enqueueKeyedJob); tick() runs them, ensureRecurringJobs never creates them. */
export const TRIGGERED_JOBS: readonly JobDefinition[] = [
  migrateMediaJob,
  deleteRetiredMediaJob,
]

/** Every handler tick() can dispatch. */
export const ALL_JOBS: readonly JobDefinition[] = [
  ...RECURRING_JOBS,
  ...TRIGGERED_JOBS,
]
