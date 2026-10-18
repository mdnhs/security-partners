import "server-only"

import { migrateDiskMediaToR2 } from "@/server/modules/media/service"

import type { JobDefinition, JobResult } from "./index"

export const MIGRATE_MEDIA_JOB = {
  name: "migrate-media",
  key: "migrate-media",
} as const
/** Work per tick, below the 60 s tick interval. */
export const MIGRATE_BUDGET_MS = 40_000

/** What one run means for the job row (exported for tests with injected storage). */
export function migrationOutcome(
  result: Awaited<ReturnType<typeof migrateDiskMediaToR2>>
): JobResult {
  if (!result.configured)
    return {
      done: true,
      warning: "R2 is not configured any more; nothing was moved.",
    }
  const warning =
    result.failed.length > 0
      ? `Not moved: ${result.failed.join("; ")}`
      : undefined
  // No progress (every file left failed): park instead of retrying the same
  // failures every tick; "Move uploads to R2" queues it again.
  if (result.moved === 0 && result.failed.length > 0 && !result.settingsChanged)
    return { park: { failed: result.failed }, warning }
  return { done: result.remaining === 0, warning }
}

/**
 * Spec §11/§12: moves disk uploads to R2 in batches until none remain
 * (everyMs 0 → due again on the next tick). Keys do not change, so no
 * cache tag needs expiring.
 */
export const migrateMediaJob: JobDefinition = {
  ...MIGRATE_MEDIA_JOB,
  everyMs: 0,
  async run() {
    return migrationOutcome(
      await migrateDiskMediaToR2({ deadline: Date.now() + MIGRATE_BUDGET_MS })
    )
  },
}
