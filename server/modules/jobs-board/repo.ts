import "server-only"

import { and, desc, eq, getTableColumns, isNotNull } from "drizzle-orm"

import type { JobContent } from "@/lib/schemas/content/job"
import type { DbOrTx } from "@/server/db/client"
import { jobOpenings, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"

const withEditor = {
  ...getTableColumns(jobOpenings),
  updatedByName: users.name,
}

/** One job plus the name of whoever changed it last (admin editor). */
export async function findJobForEdit(db: DbOrTx, id: string) {
  const [row] = await db
    .select(withEditor)
    .from(jobOpenings)
    .leftJoin(users, eq(users.id, jobOpenings.updatedBy))
    .where(eq(jobOpenings.id, id))
  return row ?? null
}

export type JobEditRow = NonNullable<Awaited<ReturnType<typeof findJobForEdit>>>

/** Every job for the admin list, the most recently changed first. */
export function listJobsForAdmin(db: DbOrTx) {
  return db
    .select(withEditor)
    .from(jobOpenings)
    .leftJoin(users, eq(users.id, jobOpenings.updatedBy))
    .orderBy(desc(jobOpenings.updatedAt), desc(jobOpenings.id))
}

export async function insertJob(
  db: DbOrTx,
  values: { slug: string; draft: JobContent; createdBy: string }
): Promise<string> {
  const [row] = await db
    .insert(jobOpenings)
    .values({ ...values, updatedBy: values.createdBy, status: "draft" })
    .returning({ id: jobOpenings.id })
  return row.id
}

/** Optimistic-lock update: only when `version` is current; null otherwise. */
export async function updateJobIfVersion(
  db: DbOrTx,
  id: string,
  version: number,
  patch: VersionedPatch<JobContent> & { slug?: string }
): Promise<JobEditRow | null> {
  const [updated] = await db
    .update(jobOpenings)
    .set({ ...patch, version: version + 1 })
    .where(and(eq(jobOpenings.id, id), eq(jobOpenings.version, version)))
    .returning({ id: jobOpenings.id })
  return updated ? findJobForEdit(db, id) : null
}

/** Deletes only when `version` is current; false when stale or gone. */
export async function deleteJobIfVersion(
  db: DbOrTx,
  id: string,
  version: number
): Promise<boolean> {
  const rows = await db
    .delete(jobOpenings)
    .where(and(eq(jobOpenings.id, id), eq(jobOpenings.version, version)))
    .returning({ id: jobOpenings.id })
  return rows.length > 0
}

/** Public: every published job (open and closed). */
export function listPublishedJobRows(db: DbOrTx) {
  return db.select().from(jobOpenings).where(isNotNull(jobOpenings.published))
}

export async function findJobBySlug(db: DbOrTx, slug: string) {
  const [row] = await db
    .select()
    .from(jobOpenings)
    .where(eq(jobOpenings.slug, slug))
  return row ?? null
}
