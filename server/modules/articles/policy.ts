import "server-only"

import type { z } from "zod"

import { hasPermission } from "@/lib/auth/permissions"
import { isEmptyDoc } from "@/lib/rich-text/read-time"
import type { ArticlePermissions } from "@/lib/schemas/api/articles"
import type { ContentStatus } from "@/lib/schemas/api/content"
import {
  type ArticleContent,
  articleContent,
} from "@/lib/schemas/content/article"
import type { DbOrTx } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { AppError, forbidden } from "@/server/lib/errors"
import { findPageByKey } from "@/server/modules/pages/repo"

// Who may do what to an article, and what an article must satisfy — shared
// by the service and the workflow transitions (transitions.ts).

export type ArticleAction =
  | "read"
  | "create"
  | "update"
  | "delete"
  | "submit"
  | "publish"
  | "updateAny"
  | "deleteAny"

export const roleCan = (actor: Actor, action: ArticleAction) =>
  hasPermission(actor.roles, { article: [action] })

export function need(actor: Actor, action: ArticleAction) {
  if (!roleCan(actor, action)) throw forbidden()
}

/**
 * What an article draft must satisfy to be saved, published or restored. An
 * editor body without words or images is stored as "no body" (the site then
 * shows the excerpt, like the seeded articles without designed copy).
 */
export const storedContent: z.ZodType<ArticleContent> =
  articleContent.transform((content) => ({
    ...content,
    body: isEmptyDoc(content.body) ? null : content.body,
  }))

type PermissionRow = {
  authorId: string | null
  published: unknown
  status: ContentStatus
}

export const isOwn = (actor: Actor, row: PermissionRow) =>
  row.authorId !== null && row.authorId === actor.userId

/** An author's own article that is neither on the site nor approved (scheduled). */
const authorMayEdit = (actor: Actor, row: PermissionRow) =>
  isOwn(actor, row) &&
  row.published === null &&
  (row.status === "draft" || row.status === "in_review")

/**
 * Whether the actor may send this article for review, whatever its status:
 * the status check is the workflow's (409), the permission is this (403).
 */
export const maySubmit = (actor: Actor, row: PermissionRow) =>
  roleCan(actor, "updateAny") ||
  (roleCan(actor, "submit") && authorMayEdit(actor, row))

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
  return {
    update:
      roleCan(actor, "updateAny") ||
      (roleCan(actor, "update") && authorMayEdit(actor, row)),
    delete:
      roleCan(actor, "deleteAny") ||
      (roleCan(actor, "delete") && authorMayEdit(actor, row)),
    submit: row.status === "draft" && maySubmit(actor, row),
    publish: roleCan(actor, "publish"),
    changeAuthor: roleCan(actor, "updateAny"),
  }
}

/**
 * The blog page features one article by slug (pages.blog featuredArticle):
 * hiding it or changing its address would empty the featured block.
 */
export async function featuredSlugs(db: DbOrTx): Promise<string[]> {
  const blog = await findPageByKey(db, "blog")
  const slugs = [blog?.draft, blog?.published].map(
    (data) =>
      (data as { featuredArticle?: string | null } | null)?.featuredArticle
  )
  return [...new Set(slugs.filter((s): s is string => !!s))]
}

export async function assertNotFeatured(
  db: DbOrTx,
  slug: string,
  field?: string
) {
  if (!(await featuredSlugs(db)).includes(slug)) return
  const message =
    "The blog page features this article. Choose another featured article on the Blog page first."
  throw new AppError(
    "CONFLICT",
    message,
    field ? { fieldErrors: { [field]: [message] } } : undefined
  )
}
