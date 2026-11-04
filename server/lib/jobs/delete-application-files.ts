import "server-only"

import {
  DELETE_APPLICATION_FILE_JOB,
  deleteQueuedApplicationFile,
} from "@/server/modules/applications/files"

import type { JobDefinition } from "./index"

/**
 * An applicant's file whose delete failed (GDPR erasure or the retention
 * purge): one keyed row per object ("application-file:<key>"), retried by
 * the scheduler until the object is gone.
 */
export const deleteApplicationFilesJob: JobDefinition = {
  name: DELETE_APPLICATION_FILE_JOB,
  key: "application-file:*",
  everyMs: 0,
  async run({ payload }) {
    const { warning } = await deleteQueuedApplicationFile(payload)
    return { done: true, warning }
  },
}
