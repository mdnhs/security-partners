import "server-only"

import { and, count, desc, eq, ilike, lt, not, or, type SQL, sql } from "drizzle-orm"

import type { ApplicationStatus } from "@/lib/schemas/api/applications"
import { containsPattern } from "@/server/db/like"
import type { DbOrTx } from "@/server/db/client"
import { jobApplications } from "@/server/db/schema"

export type ApplicationRow = typeof jobApplications.$inferSelect
export type NewApplicationRow = typeof jobApplications.$inferInsert

export type ApplicationFilters = {
  status?: ApplicationStatus
  jobId?: string
  q?: string
}

/** Inserts unless the submission was already stored; null = it was (a retry). */
export async function insertApplication(
  db: DbOrTx,
  values: NewApplicationRow
): Promise<ApplicationRow | null> {
  const [row] = await db
    .insert(jobApplications)
    .values(values)
    .onConflictDoNothing({ target: jobApplications.submissionId })
    .returning()
  return row ?? null
}

export async function findBySubmissionId(db: DbOrTx, submissionId: string) {
  const [row] = await db
    .select({ id: jobApplications.id, jobSlug: jobApplications.jobSlug })
    .from(jobApplications)
    .where(eq(jobApplications.submissionId, submissionId))
  return row ?? null
}

export async function setApplicationFiles(
  db: DbOrTx,
  id: string,
  files: Pick<NewApplicationRow, "cv" | "psaCard">
) {
  await db.update(jobApplications).set(files).where(eq(jobApplications.id, id))
}

function whereFor(f: ApplicationFilters): SQL | undefined {
  const c: (SQL | undefined)[] = []
  if (f.status) c.push(eq(jobApplications.status, f.status))
  if (f.jobId) c.push(eq(jobApplications.jobId, f.jobId))
  if (f.q) {
    const p = containsPattern(f.q)
    c.push(
      or(
        ilike(jobApplications.name, p),
        ilike(jobApplications.email, p),
        ilike(jobApplications.phone, p),
        ilike(jobApplications.jobTitle, p)
      )
    )
  }
  return and(...c)
}

export async function listApplicationRows(
  db: DbOrTx,
  opts: { filters: ApplicationFilters; page: number; pageSize: number }
): Promise<{ rows: ApplicationRow[]; total: number }> {
  const where = whereFor(opts.filters)
  const [{ total }] = await db
    .select({ total: count() })
    .from(jobApplications)
    .where(where)
  const rows = await db
    .select()
    .from(jobApplications)
    .where(where)
    .orderBy(desc(jobApplications.createdAt), desc(jobApplications.id))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}

export async function findApplicationRow(
  db: DbOrTx,
  id: string
): Promise<ApplicationRow | null> {
  const [row] = await db
    .select()
    .from(jobApplications)
    .where(eq(jobApplications.id, id))
  return row ?? null
}

export async function lockApplicationRow(db: DbOrTx, id: string) {
  const [row] = await db
    .select()
    .from(jobApplications)
    .where(eq(jobApplications.id, id))
    .for("update")
  return row ?? null
}

export async function updateApplicationRow(
  db: DbOrTx,
  id: string,
  patch: { status?: ApplicationStatus; note?: string }
) {
  await db
    .update(jobApplications)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(jobApplications.id, id))
}

/** The deleted row (its files are the caller's to remove), or null. */
export async function deleteApplicationRow(
  db: DbOrTx,
  id: string
): Promise<ApplicationRow | null> {
  const [row] = await db
    .delete(jobApplications)
    .where(eq(jobApplications.id, id))
    .returning()
  return row ?? null
}

/** The third consent: “keep my details on file”. */
const keptOnFile = sql`coalesce((${jobApplications.answers}->'consents'->>2)::boolean, false)`

/**
 * Applications past their retention: created before `cutoff`, or before
 * `keepCutoff` for an applicant who asked to be kept on file.
 */
export async function deleteApplicationsCreatedBefore(
  db: DbOrTx,
  cutoff: Date,
  keepCutoff: Date = cutoff
): Promise<ApplicationRow[]> {
  return db
    .delete(jobApplications)
    .where(
      or(
        and(lt(jobApplications.createdAt, cutoff), not(keptOnFile)),
        and(lt(jobApplications.createdAt, keepCutoff), keptOnFile)
      )
    )
    .returning()
}

export async function countNewApplications(db: DbOrTx): Promise<number> {
  const [{ total }] = await db
    .select({ total: count() })
    .from(jobApplications)
    .where(eq(jobApplications.status, "new"))
  return total
}
