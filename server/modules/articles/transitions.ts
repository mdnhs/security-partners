import "server-only"

import { readTimeMinutes } from "@/lib/rich-text/read-time"
import type { DbOrTx } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { AppError, forbidden } from "@/server/lib/errors"
import { syncMediaUsages } from "@/server/lib/media-usages"
import { validateContent } from "@/server/lib/versioning"
import { insertRevision } from "@/server/modules/revisions/repo"

import { assertNotFeatured, maySubmit, need, storedContent } from "./policy"
import * as repo from "./repo"

/** One status change of the review/publish workflow (spec §5.1, §6.1). */
export type Transition = {
  action:
    "submitted" | "published" | "scheduled" | "unscheduled" | "unpublished"
  /** 403 unless the actor may do this to this article. */
  authorize(actor: Actor, row: repo.ArticleEditRow): void
  /** Why the article's state does not allow it (→ 409), or null. */
  blockedBy(row: repo.ArticleEditRow): string | null
  /** Extra checks that need the database (→ 409/422). */
  guard?(db: DbOrTx, row: repo.ArticleEditRow): Promise<void>
  /** Column changes (may throw 422 for an invalid draft). */
  patch(row: repo.ArticleEditRow, now: Date): repo.ArticlePatch
  /** The public site changes (expire the article tags). */
  changesSite: boolean
}

const publisherOnly = (actor: Actor) => need(actor, "publish")

export const SUBMIT: Transition = {
  action: "submitted",
  // Same rule as the editor's Submit button (articlePermissions().submit),
  // minus the status: a non-draft is the workflow's 409, a locked
  // (scheduled or live) article of an author is 403.
  authorize: (actor, row) => {
    if (!maySubmit(actor, row)) throw forbidden()
  },
  blockedBy: (row) =>
    row.status === "draft" ? null : "Only drafts can be submitted for review",
  patch: () => ({ status: "in_review" }),
  changesSite: false,
}

export const PUBLISH: Transition = {
  action: "published",
  authorize: publisherOnly,
  blockedBy: () => null,
  patch: (row, now) => {
    const data = validateContent(storedContent, row.draft)
    return {
      draft: data,
      published: data,
      status: "published",
      // The post date is the first publication; edits do not redate it.
      publishedAt: row.publishedAt ?? now,
      scheduledAt: null,
      readTimeMinutes: readTimeMinutes(data.body),
    }
  },
  changesSite: true,
}

export const scheduleFor = (at: Date): Transition => ({
  action: "scheduled",
  authorize: publisherOnly,
  blockedBy: () => null,
  // Runs after the version check (ledger: 409 before 422).
  patch: (row, now) => {
    if (at.getTime() <= now.getTime())
      throw new AppError("VALIDATION_FAILED", "Choose a time in the future", {
        fieldErrors: { scheduledAt: ["Choose a time in the future"] },
      })
    // It will be published unattended: it must be publishable now.
    validateContent(storedContent, row.draft)
    return { status: "scheduled", scheduledAt: at }
  },
  changesSite: false,
})

export const UNSCHEDULE: Transition = {
  action: "unscheduled",
  authorize: publisherOnly,
  blockedBy: (row) =>
    row.status === "scheduled" ? null : "This article is not scheduled",
  patch: (row) => ({
    status: row.published === null ? "draft" : "published",
    scheduledAt: null,
  }),
  changesSite: false,
}

export const UNPUBLISH: Transition = {
  action: "unpublished",
  authorize: publisherOnly,
  blockedBy: (row) =>
    row.published === null ? "This article is not on the site" : null,
  guard: (db, row) => assertNotFeatured(db, row.slug),
  patch: () => ({
    published: null,
    status: "draft",
    publishedAt: null,
    scheduledAt: null,
  }),
  changesSite: true,
}

/**
 * Applies a transition inside the caller's transaction: optimistic update,
 * revision (data = the draft at the new version), media usages, audit.
 * `actor` is null for the scheduler. Returns null when the version is stale.
 */
export async function applyTransition(
  tx: DbOrTx,
  actor: Actor | null,
  row: repo.ArticleEditRow,
  version: number,
  transition: Transition,
  now: Date,
  extra: Record<string, unknown> = {}
): Promise<repo.ArticleEditRow | null> {
  const updated = await repo.updateArticleIfVersion(tx, row.id, version, {
    ...transition.patch(row, now),
    updatedBy: actor ? actor.userId : row.updatedBy,
  })
  if (!updated) return null
  await insertRevision(tx, {
    entityType: "article",
    entityId: row.id,
    version: updated.version,
    data: updated.draft,
    actorId: actor?.userId ?? null,
  })
  await syncMediaUsages(
    tx,
    "article",
    row.id,
    updated.draft,
    updated.published,
    { seo: updated.seo }
  )
  await writeAudit(tx, actor, {
    action: `article.${transition.action}`,
    entityType: "article",
    entityId: row.id,
    diff: { version: updated.version, status: updated.status, ...extra },
  })
  return updated
}
