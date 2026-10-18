import "server-only"

import {
  deleteRetiredMediaFile,
  RETIRED_MEDIA_JOB_NAME,
} from "@/server/modules/media/service"

import type { JobDefinition } from "./index"

/**
 * Final review minor 10: a replaced media file stays servable at its old URL
 * for RETIRED_FILE_GRACE_MS (one keyed row per old key, queued by
 * replaceMedia), then this job deletes it and its row goes away. No cache
 * tag: no page references the old key any more.
 */
export const deleteRetiredMediaJob: JobDefinition = {
  name: RETIRED_MEDIA_JOB_NAME,
  // One row per retired key ("media-retired:<key>"); never created by
  // ensureRecurringJobs (TRIGGERED_JOBS).
  key: "media-retired:*",
  everyMs: 0,
  async run({ payload }) {
    const { warning } = await deleteRetiredMediaFile(payload)
    return { done: true, warning }
  },
}
