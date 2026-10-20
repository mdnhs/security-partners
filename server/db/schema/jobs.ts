import "server-only"

import { index, integer, jsonb, pgTable, text } from "drizzle-orm/pg-core"

import { id, timestamps, tsz } from "./_shared"

/** In-process scheduler queue (spec §12), claimed with FOR UPDATE SKIP LOCKED in Phase 5. */
export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    name: text("name").notNull(),
    /** Dedupe key for singleton/per-entity jobs; null = no dedupe. */
    key: text("key").unique(),
    payload: jsonb("payload"),
    runAt: tsz("run_at").notNull(),
    lockedAt: tsz("locked_at"),
    attempts: integer("attempts").notNull().default(0),
    lastRunAt: tsz("last_run_at"),
    lastError: text("last_error"),
    ...timestamps(),
  },
  (t) => [index("jobs_run_at_idx").on(t.runAt)]
)
