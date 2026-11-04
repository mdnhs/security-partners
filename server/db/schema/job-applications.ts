import "server-only"

import { index, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core"

import {
  APPLICATION_STATUSES,
  type ApplicationAnswers,
  type StoredFile,
} from "@/lib/schemas/api/applications"

import { id, timestamps } from "./_shared"
import { jobOpenings } from "./job-openings"

export const applicationStatus = pgEnum(
  "application_status",
  APPLICATION_STATUSES
)

/**
 * Applications for a careers opening (plan 2026-11-04-careers, Task 5).
 * Files live in storage under applications/<id>/ and are never media rows:
 * the public file route cannot serve them.
 */
export const jobApplications = pgTable(
  "job_applications",
  {
    id: id(),
    /** The form's token: a retry or double submit finds the first row. */
    submissionId: uuid("submission_id").notNull().unique(),
    jobId: uuid("job_id").references(() => jobOpenings.id, {
      onDelete: "set null",
    }),
    /** As applied for: the job may be renamed or deleted later. */
    jobTitle: text("job_title").notNull(),
    jobSlug: text("job_slug").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    status: applicationStatus("status").notNull().default("new"),
    answers: jsonb("answers").$type<ApplicationAnswers>().notNull(),
    cv: jsonb("cv").$type<StoredFile>().notNull(),
    psaCard: jsonb("psa_card").$type<StoredFile>(),
    note: text("note").notNull().default(""),
    /** HMAC of the client IP, never the raw IP. */
    ipHash: text("ip_hash"),
    ...timestamps(),
  },
  (t) => [
    index("job_applications_created_at_idx").on(t.createdAt),
    index("job_applications_status_idx").on(t.status),
    index("job_applications_job_id_idx").on(t.jobId),
  ]
)
