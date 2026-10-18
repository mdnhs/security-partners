import "server-only"

import { publishScheduledJob } from "./publish-scheduled"
import { pruneRevisionsJob } from "./prune-revisions"

export type JobContext = { now: Date; payload: unknown }
/** `tags`: cache tags to expire; `warning`: recorded in jobs.last_error without failing the run. */
export type JobResult = { tags?: string[]; warning?: string }
export type JobDefinition = {
  name: string
  /** jobs.key: one row per recurring job. */
  key: string
  /** Next run = this long after a successful run. */
  everyMs: number
  run(ctx: JobContext): Promise<JobResult>
}

/** Spec §12 jobs owned by this phase (leads purge, backup, media migration come later). */
export const RECURRING_JOBS: readonly JobDefinition[] = [
  publishScheduledJob,
  pruneRevisionsJob,
]
