import "server-only"

import { runBackup } from "@/server/lib/backup"

import type { JobDefinition } from "./index"

export const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * Daily DB backup (spec §12). A failure throws: the scheduler records it in
 * jobs.last_error (dashboard "Next up") and retries after 60 s.
 */
export const backupJob: JobDefinition = {
  name: "backup",
  key: "backup",
  everyMs: BACKUP_INTERVAL_MS,
  async run() {
    await runBackup()
    return {}
  },
}
