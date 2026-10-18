import "server-only"

import { hasPermission, parseRoles } from "@/lib/auth/permissions"
import type {
  ArticleDto,
  ArticleListItem,
  ArticleListQuery,
  ArticleOptions,
} from "@/lib/schemas/api/articles"
import type { Paginated } from "@/lib/schemas/api/list"
import type { ArticleContent } from "@/lib/schemas/content/article"
import { type Db, type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import {
  AppError,
  conflict,
  errorKind,
  forbidden,
  notFound,
  safeErrorMessage,
} from "@/server/lib/errors"
import { clearMediaUsages, syncMediaUsages } from "@/server/lib/media-usages"
import {
  pgConstraint,
  pgErrorCode,
  UNIQUE_VIOLATION,
} from "@/server/lib/pg-errors"
import {
  restoreRevision,
  saveDraft,
  validateContent,
  type VersionedStore,
  versionedDto,
} from "@/server/lib/versioning"
import { recordMove } from "@/server/modules/redirects/service"
import { insertRevision } from "@/server/modules/revisions/repo"

import {
  articlePermissions,
  assertNotFeatured,
  featuredSlugs,
  need,
  roleCan,
  storedContent,
} from "./policy"
import * as repo from "./repo"
import {
  applyTransition,
  PUBLISH,
  scheduleFor,
  SUBMIT,
  type Transition,
  UNPUBLISH,
  UNSCHEDULE,
} from "./transitions"

export { articlePermissions } from "./policy"

function toDto(row: repo.ArticleEditRow, actor: Actor): ArticleDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.draft.title,
    live: row.published !== null,
    category: {
      id: row.categoryId,
      slug: row.categorySlug,
      name: row.categoryName,
    },
    author:
      row.authorId && row.authorName !== null
        ? { id: row.authorId, name: row.authorName, title: row.authorTitle }
        : null,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    readTimeMinutes: row.readTimeMinutes,
    createdAt: row.createdAt.toISOString(),
    permissions: articlePermissions(actor, row),
    ...versionedDto<ArticleContent>(row),
  }
}

function listItem(dto: ArticleDto): ArticleListItem {
  const item: Partial<ArticleDto> = dto
  delete item.draft
  delete item.published
  return item as ArticleListItem
}

/** Versioning adapter (Phase 4 saveDraft/restoreRevision); 409s carry the actor's view. */
const storeFor = (
  actor: Actor
): VersionedStore<ArticleContent, repo.ArticleEditRow> => ({
  entityType: "article",
  label: "Article",
  schema: () => storedContent,
  find: (db, id) => repo.findArticleForEdit(db, id),
  update: (db, id, version, patch) =>
    repo.updateArticleIfVersion(db, id, version, patch),
  tags: (row) => [tag.articles, tag.article(row.slug)],
  mediaValues: (row) => [row.draft, row.published, { seo: row.seo }],
  present: (row) => toDto(row, actor),
})

async function loadRow(db: DbOrTx, id: string) {
  const row = await repo.findArticleForEdit(db, id)
  if (!row) throw notFound("Article")
  return row
}

/** After a lost optimistic update: 404 if the article is gone, else 409 with its current state. */
async function staleOrMissing(
  db: DbOrTx,
  id: string,
  actor: Actor
): Promise<never> {
  throw conflict(toDto(await loadRow(db, id), actor))
}

const slugTaken = () =>
  new AppError("CONFLICT", "Another article already uses this address", {
    fieldErrors: { slug: ["Already used by another article"] },
  })

async function assertCategory(db: DbOrTx, id: string) {
  if (!(await repo.categoryExists(db, id)))
    throw new AppError("VALIDATION_FAILED", "Choose a category", {
      fieldErrors: { categoryId: ["This category no longer exists"] },
    })
}

/**
 * A byline is someone who writes articles (article:create) or already signs
 * one (e.g. the seeded no-login bylines) — the people getArticleOptions offers.
 */
async function assertAuthor(db: DbOrTx, id: string) {
  const candidate = await repo.findBylineCandidate(db, id)
  if (!candidate)
    throw new AppError("VALIDATION_FAILED", "Choose a byline", {
      fieldErrors: { authorId: ["This user no longer exists"] },
    })
  if (
    !candidate.signsArticle &&
    !hasPermission(parseRoles(candidate.role), { article: ["create"] })
  )
    throw new AppError("VALIDATION_FAILED", "Choose a byline", {
      fieldErrors: { authorId: ["Choose someone who writes articles"] },
    })
}

// ---------------------------------------------------------------- reads

export async function listArticlesAdmin(
  actor: Actor,
  query: ArticleListQuery
): Promise<Paginated<ArticleListItem>> {
  need(actor, "read")
  const { rows, total } = await repo.listArticlesForAdmin(getDb(), {
    q: query.q || undefined,
    status: query.status,
    categoryId: query.category,
    authorId: query.author === "me" ? actor.userId : query.author,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map((row) => listItem(toDto(row, actor))),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getArticleAdmin(
  actor: Actor,
  id: string
): Promise<ArticleDto> {
  need(actor, "read")
  return toDto(await loadRow(getDb(), id), actor)
}

/** Category list for every reader; byline candidates only for editors and up. */
export async function getArticleOptions(actor: Actor): Promise<ArticleOptions> {
  need(actor, "read")
  const db = getDb()
  const [categories, featured] = await Promise.all([
    repo.listCategoryOptions(db),
    featuredSlugs(db),
  ])
  if (!roleCan(actor, "updateAny")) return { categories, authors: [], featured }
  const [people, bylines] = await Promise.all([
    repo.listUsersForByline(db),
    repo.bylineAuthorIds(db),
  ])
  return {
    categories,
    authors: people
      .filter(
        (person) =>
          bylines.has(person.id) ||
          hasPermission(parseRoles(person.role), { article: ["create"] })
      )
      .map(({ id, name, title }) => ({ id, name, title })),
    featured,
  }
}

// ---------------------------------------------------------------- writes

/** New articles start as a draft under the actor's byline (editors may choose another). */
export async function createArticle(
  actor: Actor,
  input: {
    slug: string
    categoryId: string
    authorId?: string | null
    draft: unknown
  }
): Promise<ArticleDto> {
  need(actor, "create")
  const authorId = input.authorId === undefined ? actor.userId : input.authorId
  if (authorId !== actor.userId && !roleCan(actor, "updateAny"))
    throw forbidden()
  const draft = validateContent(storedContent, input.draft)
  const db = getDb()
  try {
    const id = await db.transaction(async (tx) => {
      await assertCategory(tx, input.categoryId)
      if (authorId) await assertAuthor(tx, authorId)
      const newId = await repo.insertArticle(tx, {
        slug: input.slug,
        categoryId: input.categoryId,
        authorId,
        draft,
        updatedBy: actor.userId,
      })
      await syncMediaUsages(tx, "article", newId, draft)
      await insertRevision(tx, {
        entityType: "article",
        entityId: newId,
        version: 1,
        data: draft,
        actorId: actor.userId,
      })
      await writeAudit(tx, actor, {
        action: "article.created",
        entityType: "article",
        entityId: newId,
        diff: { slug: input.slug, authorId },
      })
      return newId
    })
    return toDto(await loadRow(db, id), actor)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
    throw err
  }
}

/**
 * Autosave. The permission check reads the current row; the save itself
 * only succeeds while the version is unchanged, so a publish in between
 * (version + 1) turns the author's save into a 409, never an edit of live
 * content.
 */
export async function saveArticleDraft(
  actor: Actor,
  id: string,
  input: { draft: unknown; version: number }
): Promise<ArticleDto> {
  need(actor, "update")
  const db = getDb()
  if (!articlePermissions(actor, await loadRow(db, id)).update)
    throw forbidden()
  return toDto(await saveDraft(db, storeFor(actor), actor, id, input), actor)
}

export async function restoreArticle(
  actor: Actor,
  id: string,
  input: { revisionId: string; version: number }
): Promise<ArticleDto> {
  need(actor, "update")
  const db = getDb()
  if (!articlePermissions(actor, await loadRow(db, id)).update)
    throw forbidden()
  return toDto(
    await restoreRevision(db, storeFor(actor), actor, id, input),
    actor
  )
}

/** Address, category and byline are columns: they change the site at once. */
export async function changeArticleMeta(
  actor: Actor,
  id: string,
  input: {
    version: number
    slug?: string
    categoryId?: string
    authorId?: string | null
  }
): Promise<ArticleDto> {
  need(actor, "update")
  const db = getDb()
  try {
    const { before, after } = await db.transaction(async (tx) => {
      const row = await loadRow(tx, id)
      const permissions = articlePermissions(actor, row)
      if (!permissions.update) throw forbidden()
      if (
        input.authorId !== undefined &&
        input.authorId !== row.authorId &&
        !permissions.changeAuthor
      )
        throw forbidden()
      if (row.version !== input.version) throw conflict(toDto(row, actor))
      if (input.slug !== undefined && input.slug !== row.slug)
        await assertNotFeatured(tx, row.slug, "slug")
      if (input.categoryId !== undefined)
        await assertCategory(tx, input.categoryId)
      if (input.authorId) await assertAuthor(tx, input.authorId)
      const patch: repo.ArticlePatch = { updatedBy: actor.userId }
      if (input.slug !== undefined) patch.slug = input.slug
      if (input.categoryId !== undefined) patch.categoryId = input.categoryId
      if (input.authorId !== undefined) patch.authorId = input.authorId
      const updated = await repo.updateArticleIfVersion(
        tx,
        id,
        input.version,
        patch
      )
      if (!updated) return staleOrMissing(tx, id, actor)
      await writeAudit(tx, actor, {
        action: "article.meta_changed",
        entityType: "article",
        entityId: id,
        diff: {
          from: {
            slug: row.slug,
            categoryId: row.categoryId,
            authorId: row.authorId,
          },
          to: {
            slug: updated.slug,
            categoryId: updated.categoryId,
            authorId: updated.authorId,
          },
        },
      })
      if (row.published !== null && updated.slug !== row.slug)
        await recordMove(tx, actor, {
          from: `/blog/${row.slug}`,
          to: `/blog/${updated.slug}`,
          reason: "article.slug_changed",
        })
      return { before: row, after: updated }
    })
    if (before.published !== null)
      invalidate(
        tag.articles,
        tag.article(before.slug),
        ...(after.slug !== before.slug ? [tag.article(after.slug)] : [])
      )
    return toDto(after, actor)
  } catch (err) {
    if (pgErrorCode(err) === UNIQUE_VIOLATION) throw slugTaken()
    throw err
  }
}

export async function deleteArticle(
  actor: Actor,
  id: string,
  input: { version: number }
): Promise<{ ok: true }> {
  need(actor, "delete")
  const removed = await getDb().transaction(async (tx) => {
    const row = await loadRow(tx, id)
    if (!articlePermissions(actor, row).delete) throw forbidden()
    if (row.version !== input.version) throw conflict(toDto(row, actor))
    await assertNotFeatured(tx, row.slug)
    await clearMediaUsages(tx, "article", id)
    if (!(await repo.deleteArticleIfVersion(tx, id, input.version)))
      return staleOrMissing(tx, id, actor)
    await writeAudit(tx, actor, {
      action: "article.deleted",
      entityType: "article",
      entityId: id,
      diff: { slug: row.slug, version: row.version },
    })
    if (row.published !== null)
      await recordMove(tx, actor, {
        from: `/blog/${row.slug}`,
        to: "/blog",
        reason: "article.deleted",
      })
    return row
  })
  if (removed.published !== null)
    invalidate(tag.articles, tag.article(removed.slug))
  return { ok: true }
}

// ---------------------------------------------------------------- workflow

/** revisions UNIQUE(entity_type, entity_id, version) (migration 0004). */
const REVISION_VERSION_UNIQUE = "revisions_entity_version_unique"

async function runTransition(
  actor: Actor,
  id: string,
  version: number,
  transition: Transition,
  extra?: Record<string, unknown>
): Promise<ArticleDto> {
  const db = getDb()
  let after: repo.ArticleEditRow
  try {
    after = await transitionInTx(db, actor, id, version, transition, extra)
  } catch (err) {
    if (
      pgErrorCode(err) === UNIQUE_VIOLATION &&
      pgConstraint(err) === REVISION_VERSION_UNIQUE
    ) {
      // Like Phase 4 publish(): the versioned UPDATE serialises transitions
      // of one article (row lock), so a revision clash after the article
      // moved on is a lost race → 409 with the current state. Otherwise a
      // leftover revision row holds this version — a data fault the editor
      // cannot resolve: log it and answer a plain 500.
      const current = await loadRow(db, id)
      if (current.version !== version) throw conflict(toDto(current, actor))
      console.error(
        `[articles] article/${id}: revision ${version + 1} already exists; ${transition.action} rolled back`
      )
    } else if (pgErrorCode(err) === UNIQUE_VIOLATION)
      console.error(
        `[articles] article/${id}: ${transition.action} hit a unique constraint (${pgConstraint(err) ?? "unknown"}); rolled back`
      )
    throw err
  }
  if (transition.changesSite) invalidate(tag.articles, tag.article(after.slug))
  return toDto(after, actor)
}

function transitionInTx(
  db: Db,
  actor: Actor,
  id: string,
  version: number,
  transition: Transition,
  extra?: Record<string, unknown>
): Promise<repo.ArticleEditRow> {
  return db.transaction(async (tx) => {
    const row = await loadRow(tx, id)
    transition.authorize(actor, row)
    if (row.version !== version) throw conflict(toDto(row, actor))
    const blocked = transition.blockedBy(row)
    if (blocked)
      throw new AppError("CONFLICT", blocked, { current: toDto(row, actor) })
    await transition.guard?.(tx, row)
    const updated = await applyTransition(
      tx,
      actor,
      row,
      version,
      transition,
      new Date(),
      extra
    )
    if (!updated) return staleOrMissing(tx, id, actor)
    return updated
  })
}

export const submitArticle = (
  actor: Actor,
  id: string,
  input: { version: number }
) => runTransition(actor, id, input.version, SUBMIT)

export async function publishArticle(
  actor: Actor,
  id: string,
  input: { version: number }
) {
  need(actor, "publish")
  return runTransition(actor, id, input.version, PUBLISH)
}

/** Publish later; the scheduler (spec §12) publishes it at `scheduledAt`. */
export async function scheduleArticle(
  actor: Actor,
  id: string,
  input: { version: number; scheduledAt: string }
) {
  need(actor, "publish")
  const at = new Date(input.scheduledAt)
  // The past-time check (422) lives in the transition, after the version
  // check (409), like every other validation (ledger ruling).
  return runTransition(actor, id, input.version, scheduleFor(at), {
    scheduledAt: at.toISOString(),
  })
}

export async function unscheduleArticle(
  actor: Actor,
  id: string,
  input: { version: number }
) {
  need(actor, "publish")
  return runTransition(actor, id, input.version, UNSCHEDULE)
}

export async function unpublishArticle(
  actor: Actor,
  id: string,
  input: { version: number }
) {
  need(actor, "publish")
  return runTransition(actor, id, input.version, UNPUBLISH)
}

// ---------------------------------------------------------------- scheduler

/**
 * Scheduler job (spec §12): publishes every scheduled article whose time
 * has come. Due rows are locked FOR UPDATE SKIP LOCKED, so concurrent ticks
 * (several replicas) publish each article exactly once; each article runs
 * in its own savepoint, so one that no longer validates stays scheduled
 * without holding back the others. Audit and revision rows have no actor.
 * Returns the cache tags to expire — the caller has no request context
 * (ledger ruling).
 */
const PUBLISH_FAILED = "Database error while publishing"

export async function publishDueArticles(
  now: Date = new Date()
): Promise<{ published: string[]; failed: string[]; tags: string[] }> {
  const published: string[] = []
  const failed: string[] = []
  await getDb().transaction(async (tx) => {
    for (const { id } of await repo.lockDueScheduledArticles(tx, now)) {
      let label = id
      try {
        await tx.transaction(async (savepoint) => {
          const row = await loadRow(savepoint, id)
          label = row.slug
          const updated = await applyTransition(
            savepoint,
            null,
            row,
            row.version,
            PUBLISH,
            now,
            { scheduled: true }
          )
          if (updated) published.push(updated.slug)
        })
      } catch (err) {
        const text = safeErrorMessage(err, PUBLISH_FAILED)
        // Raw driver text (SQL, parameters) goes neither to jobs.last_error
        // nor to the log: only its code.
        if (text === PUBLISH_FAILED)
          console.error(
            `[scheduler] publish ${label} failed: ${errorKind(err)}`
          )
        failed.push(`${label}: ${text}`)
      }
    }
  })
  return {
    published,
    failed,
    tags:
      published.length > 0
        ? [tag.articles, ...published.map((slug) => tag.article(slug))]
        : [],
  }
}
