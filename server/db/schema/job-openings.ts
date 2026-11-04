import "server-only"

import { sql } from "drizzle-orm"
import { check, pgTable, text, uuid } from "drizzle-orm/pg-core"

import type { JobContent } from "@/lib/schemas/content/job"

import { id, timestamps } from "./_shared"
import { versioned } from "./_versioned"
import { users } from "./auth"

/**
 * Careers openings at /careers/<slug> (plan 2026-11-04-careers, Task 2).
 * Not `jobs`: that table is the scheduler's (server/db/schema/jobs.ts).
 */
export const jobOpenings = pgTable(
  "job_openings",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    ...versioned<JobContent>(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
  },
  (t) => [
    check(
      "job_openings_slug_format",
      sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${t.slug}) <= 80`
    ),
  ]
)
