import "server-only"

import { getDb } from "@/server/db/client"
import { pruneRevisionRows } from "@/server/modules/revisions/repo"

import type { JobDefinition } from "./index"

/** Spec §12: revision pruning keeps the last 50 per entity. */
export const REVISIONS_KEPT = 50

export const pruneRevisionsJob: JobDefinition = {
  name: "prune-revisions",
  key: "prune-revisions",
  everyMs: 24 * 60 * 60_000,
  async run() {
    await pruneRevisionRows(getDb(), REVISIONS_KEPT)
    return {}
  },
}
