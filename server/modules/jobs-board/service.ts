import "server-only"

import { dublinToday, isOpen } from "@/lib/careers/open"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import {
  JOB_ENTITY,
  type JobDto,
  type JobListItem,
  jobPath,
} from "@/lib/schemas/api/jobs"
import { type JobContent, jobContent } from "@/lib/schemas/content/job"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { AppError, conflict, forbidden, notFound } from "@/server/lib/errors"
import { pgErrorCode, UNIQUE_VIOLATION } from "@/server/lib/pg-errors"
import {
  publish,
  restoreRevision,
  saveDraft,
  type VersionedStore,
  versionedDto,
} from "@/server/lib/versioning"
import { recordMove } from "@/server/modules/redirects/service"

import * as repo from "./repo"

function assertCan(actor: Actor, req: PermissionRequest) {
  if (!hasPermission(actor.roles, req)) throw forbidden()
}

function toDto(row: repo.JobEditRow): JobDto {
  return {
    ...versionedDto<JobContent>(row),
    id: row.id,
    slug: row.slug,
    path: jobPath(row.slug),
    title: row.draft.title,
    createdAt: row.createdAt.toISOString(),
  }
}

const slugTaken = () =>
  new AppError("CONFLICT", "Another job already uses this address", {
    fieldErrors: { slug: ["Already used by another job"] },
  })

const mapUnique = (err: unknown): never => {
  if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
  throw err
}

/** Versioning adapter: drafts and publishes satisfy jobContent. */
export const jobStore: VersionedStore<JobContent, repo.JobEditRow> = {
  entityType: JOB_ENTITY,
  label: "Job",
  schema: () => jobContent,
  find: (db, id) => repo.findJobForEdit(db, id),
  update: (db, id, version, patch) =>
    repo.updateJobIfVersion(db, id, version, patch),
  tags: (row) => [tag.jobs, tag.job(row.slug)],
  present: (row) => toDto(row),
}

/** Thirty days from `now`, on the Irish calendar. */
function inThirtyDays(now: Date): string {
  const [y, m, d] = dublinToday(now).split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + 30)).toISOString().slice(0, 10)
}

/** A complete, valid first draft: the editor replaces every line. */
function starterDraft(title: string, slug: string, now: Date): JobContent {
  const yymm = dublinToday(now).slice(2, 7).replace("-", "")
  const initials = slug
    .split("-")
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase()
  return {
    title,
    category: "Static Guarding",
    licence: "Security Guard (Static)",
    location: "Portlaoise, Co. Laois",
    employmentType: "Full-time, Permanent",
    contractType: "full-time",
    shift: "To be confirmed",
    pay: "To be confirmed",
    reference: `SP-${yymm}-${initials}`,
    startDate: "To be confirmed",
    closingDate: inThirtyDays(now),
    urgent: false,
    filled: false,
    summary: title,
    about: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Describe the role here." }],
        },
      ],
    },
    responsibilities: ["Describe a responsibility"],
    essential: ["Describe a requirement"],
    desirable: [],
    offerIntro: "",
    offers: [],
  }
}

// ---------------------------------------------------------------- reads

export async function listJobsAdmin(
  actor: Actor,
  now: Date = new Date()
): Promise<JobListItem[]> {
  assertCan(actor, { job: ["read"] })
  const rows = await repo.listJobsForAdmin(getDb())
  return rows.map((row) => {
    const dto: Partial<JobDto> = toDto(row)
    delete dto.draft
    delete dto.published
    const live = row.published
    return {
      ...(dto as Omit<JobDto, "draft" | "published">),
      open: live ? isOpen(live, now) : null,
      closingDate: (live ?? row.draft).closingDate,
      category: (live ?? row.draft).category,
    }
  })
}

export async function getJobAdmin(actor: Actor, id: string): Promise<JobDto> {
  assertCan(actor, { job: ["read"] })
  const row = await repo.findJobForEdit(getDb(), id)
  if (!row) throw notFound("Job")
  return toDto(row)
}

// ---------------------------------------------------------------- writes

export async function createJob(
  actor: Actor,
  input: { title: string; slug: string },
  now: Date = new Date()
): Promise<JobDto> {
  assertCan(actor, { job: ["create"] })
  const db = getDb()
  try {
    const id = await db.transaction(async (tx) => {
      const newId = await repo.insertJob(tx, {
        slug: input.slug,
        draft: starterDraft(input.title, input.slug, now),
        createdBy: actor.userId,
      })
      await writeAudit(tx, actor, {
        action: `${JOB_ENTITY}.created`,
        entityType: JOB_ENTITY,
        entityId: newId,
        diff: { slug: input.slug },
      })
      return newId
    })
    return toDto((await repo.findJobForEdit(db, id))!)
  } catch (err) {
    return mapUnique(err)
  }
}

export async function saveJobDraft(
  actor: Actor,
  id: string,
  input: { draft: unknown; version: number }
): Promise<JobDto> {
  assertCan(actor, { job: ["update"] })
  return toDto(await saveDraft(getDb(), jobStore, actor, id, input))
}

export async function publishJob(
  actor: Actor,
  id: string,
  input: { version: number }
): Promise<JobDto> {
  assertCan(actor, { job: ["publish"] })
  return toDto(await publish(getDb(), jobStore, actor, id, input))
}

export async function restoreJob(
  actor: Actor,
  id: string,
  input: { revisionId: string; version: number }
): Promise<JobDto> {
  assertCan(actor, { job: ["update"] })
  return toDto(await restoreRevision(getDb(), jobStore, actor, id, input))
}

/** The address is a column: it moves the live page now (301 from the old one). */
export async function changeJobSlug(
  actor: Actor,
  id: string,
  input: { slug: string; version: number }
): Promise<JobDto> {
  assertCan(actor, { job: ["update"] })
  try {
    const { before, after, moved } = await getDb().transaction(async (tx) => {
      const existing = await repo.findJobForEdit(tx, id)
      if (!existing) throw notFound("Job")
      const updated = await repo.updateJobIfVersion(tx, id, input.version, {
        slug: input.slug,
        updatedBy: actor.userId,
      })
      if (!updated) {
        const current = await repo.findJobForEdit(tx, id)
        if (!current) throw notFound("Job")
        throw conflict(toDto(current))
      }
      await writeAudit(tx, actor, {
        action: `${JOB_ENTITY}.slug_changed`,
        entityType: JOB_ENTITY,
        entityId: id,
        diff: { from: existing.slug, to: input.slug },
      })
      const moved =
        existing.published !== null &&
        existing.slug !== input.slug &&
        (await recordMove(tx, actor, {
          from: jobPath(existing.slug),
          to: jobPath(input.slug),
          reason: `${JOB_ENTITY}.slug_changed`,
        }))
      return { before: existing, after: updated, moved }
    })
    invalidate(
      tag.jobs,
      tag.job(before.slug),
      tag.job(after.slug),
      ...(moved ? [tag.redirects] : [])
    )
    return toDto(after)
  } catch (err) {
    return mapUnique(err)
  }
}

/** Removes the job; a published one's address points to /careers (301). */
export async function deleteJob(
  actor: Actor,
  id: string,
  input: { version: number }
): Promise<{ ok: true }> {
  assertCan(actor, { job: ["delete"] })
  const { removed, moved } = await getDb().transaction(async (tx) => {
    const existing = await repo.findJobForEdit(tx, id)
    if (!existing) throw notFound("Job")
    if (existing.version !== input.version) throw conflict(toDto(existing))
    if (!(await repo.deleteJobIfVersion(tx, id, input.version))) {
      const current = await repo.findJobForEdit(tx, id)
      if (!current) throw notFound("Job")
      throw conflict(toDto(current))
    }
    await writeAudit(tx, actor, {
      action: `${JOB_ENTITY}.deleted`,
      entityType: JOB_ENTITY,
      entityId: id,
      diff: { slug: existing.slug },
    })
    const moved =
      existing.published !== null &&
      (await recordMove(tx, actor, {
        from: jobPath(existing.slug),
        to: "/careers",
        reason: `${JOB_ENTITY}.deleted`,
      }))
    return { removed: existing, moved }
  })
  invalidate(tag.jobs, tag.job(removed.slug), ...(moved ? [tag.redirects] : []))
  return { ok: true as const }
}
