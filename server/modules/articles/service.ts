import "server-only"

import type { z } from "zod"

import { hasPermission, parseRoles } from "@/lib/auth/permissions"
import { isEmptyDoc, readTimeMinutes } from "@/lib/rich-text/read-time"
import type {
  ArticleDto,
  ArticleListItem,
  ArticleListQuery,
  ArticleOptions,
  ArticlePermissions,
} from "@/lib/schemas/api/articles"
import type { ContentStatus } from "@/lib/schemas/api/content"
import type { Paginated } from "@/lib/schemas/api/list"
import {
  type ArticleContent,
  articleContent,
} from "@/lib/schemas/content/article"
import { type DbOrTx, getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { writeAudit } from "@/server/lib/audit"
import { invalidate, tag } from "@/server/lib/cache-tags"
import { AppError, conflict, forbidden, notFound } from "@/server/lib/errors"
import { clearMediaUsages, syncMediaUsages } from "@/server/lib/media-usages"
import { pgErrorCode, UNIQUE_VIOLATION } from "@/server/lib/pg-errors"
import {
  restoreRevision,
  saveDraft,
  validateContent,
  type VersionedStore,
  versionedDto,
} from "@/server/lib/versioning"
import { findPageByKey } from "@/server/modules/pages/repo"
import { insertRevision } from "@/server/modules/revisions/repo"

import * as repo from "./repo"

type ArticleAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "submit"
  | "publish"
  | "updateAny"
  | "deleteAny"

const roleCan = (actor: Actor, action: ArticleAction) =>
  hasPermission(actor.roles, { article: [action] })

function need(actor: Actor, action: ArticleAction) {
  if (!roleCan(actor, action)) throw forbidden()
}

/**
 * What an article draft must satisfy to be saved, published or restored. An
 * editor body without words or images is stored as "no body" (the site then
 * shows the excerpt, like the seeded articles without designed copy).
 */
const storedContent: z.ZodType<ArticleContent> = articleContent.transform(
  (content) => ({
    ...content,
    body: isEmptyDoc(content.body) ? null : content.body,
  })
)

type PermissionRow = {
  authorId: string | null
  published: unknown
  status: ContentStatus
}

const isOwn = (actor: Actor, row: PermissionRow) =>
  row.authorId !== null && row.authorId === actor.userId

/**
 * Spec §6.1: editors and up change any article. Authors change, delete and
 * submit only their own, and only while it is not on the site and not yet
 * scheduled (scheduled = approved by an editor). Publishing, scheduling and
 * unpublishing are never author rights (Review Focus 5).
 */
export function articlePermissions(
  actor: Actor,
  row: PermissionRow
): ArticlePermissions {
  const authorMayEdit =
    isOwn(actor, row) &&
    row.published === null &&
    (row.status === "draft" || row.status === "in_review")
  return {
    update:
      roleCan(actor, "updateAny") ||
      (roleCan(actor, "update") && authorMayEdit),
    delete:
      roleCan(actor, "deleteAny") ||
      (roleCan(actor, "delete") && authorMayEdit),
    submit:
      row.status === "draft" &&
      (roleCan(actor, "updateAny") ||
        (roleCan(actor, "submit") && authorMayEdit)),
    publish: roleCan(actor, "publish"),
    changeAuthor: roleCan(actor, "updateAny"),
  }
}

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

async function assertAuthor(db: DbOrTx, id: string) {
  if (!(await repo.userExists(db, id)))
    throw new AppError("VALIDATION_FAILED", "Choose a byline", {
      fieldErrors: { authorId: ["This user no longer exists"] },
    })
}

/**
 * The blog page features one article by slug (pages.blog featuredArticle):
 * hiding it or changing its address would empty the featured block.
 */
async function assertNotFeatured(db: DbOrTx, slug: string, field?: string) {
  const blog = await findPageByKey(db, "blog")
  const featured = [blog?.draft, blog?.published].map(
    (data) =>
      (data as { featuredArticle?: string | null } | null)?.featuredArticle
  )
  if (!featured.includes(slug)) return
  const message =
    "The blog page features this article. Choose another featured article on the Blog page first."
  throw new AppError(
    "CONFLICT",
    message,
    field ? { fieldErrors: { [field]: [message] } } : undefined
  )
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
  const categories = await repo.listCategoryOptions(db)
  if (!roleCan(actor, "updateAny")) return { categories, authors: [] }
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
    return row
  })
  if (removed.published !== null)
    invalidate(tag.articles, tag.article(removed.slug))
  return { ok: true }
}

// ---------------------------------------------------------------- workflow

/** One status change of the review/publish workflow (spec §5.1, §6.1). */
type Transition = {
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

const SUBMIT: Transition = {
  action: "submitted",
  authorize: (actor, row) => {
    if (
      !roleCan(actor, "updateAny") &&
      !(roleCan(actor, "submit") && isOwn(actor, row) && row.published === null)
    )
      throw forbidden()
  },
  blockedBy: (row) =>
    row.status === "draft" ? null : "Only drafts can be submitted for review",
  patch: () => ({ status: "in_review" }),
  changesSite: false,
}

const PUBLISH: Transition = {
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

const scheduleFor = (at: Date): Transition => ({
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

const UNSCHEDULE: Transition = {
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

const UNPUBLISH: Transition = {
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
async function applyTransition(
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
  await syncMediaUsages(tx, "article", row.id, updated.draft, updated.published)
  await writeAudit(tx, actor, {
    action: `article.${transition.action}`,
    entityType: "article",
    entityId: row.id,
    diff: { version: updated.version, status: updated.status, ...extra },
  })
  return updated
}

async function runTransition(
  actor: Actor,
  id: string,
  version: number,
  transition: Transition,
  extra?: Record<string, unknown>
): Promise<ArticleDto> {
  const after = await getDb().transaction(async (tx) => {
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
  if (transition.changesSite) invalidate(tag.articles, tag.article(after.slug))
  return toDto(after, actor)
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
