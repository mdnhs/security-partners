import { z } from "zod"

import { slug } from "@/lib/schemas/common"
import type { ArticleContent } from "@/lib/schemas/content/article"

import { CONTENT_STATUSES, type VersionedDto, versionInput } from "./content"
import { listQuery, sortParam } from "./list"

/** GET /articles — filters for the admin list and the review queue. */
export const articleListQuery = listQuery.extend({
  sort: sortParam(["updatedAt", "publishedAt", "title", "scheduledAt"], {
    field: "updatedAt",
    dir: "desc",
  }),
  status: z.enum(CONTENT_STATUSES).optional(),
  category: z.uuid().optional(),
  /** A user id, or "me" for the signed-in user. */
  author: z.union([z.literal("me"), z.uuid()]).optional(),
})
export type ArticleListQuery = z.output<typeof articleListQuery>

/** POST /articles — the draft is validated against articleContent by the service. */
export const createArticleInput = z.object({
  slug,
  categoryId: z.uuid(),
  /** Editors pick the byline (null = none); authors always write as themselves. Omit → the signed-in user. */
  authorId: z.uuid().nullable().optional(),
  draft: z.unknown(),
})

/** PATCH /articles/:id/meta — columns outside the draft; they change the site at once. */
export const articleMetaInput = versionInput
  .extend({
    slug: slug.optional(),
    categoryId: z.uuid().optional(),
    authorId: z.uuid().nullable().optional(),
  })
  .refine(
    (v) =>
      v.slug !== undefined ||
      v.categoryId !== undefined ||
      v.authorId !== undefined,
    { message: "Nothing to change" }
  )

/** POST /articles/:id/schedule — an ISO 8601 instant (UTC or with an offset). */
export const scheduleInput = versionInput.extend({
  scheduledAt: z.iso.datetime({ offset: true }),
})

/** DELETE /articles/:id?version= */
export const articleVersionQuery = z.object({
  version: z.coerce.number().int().min(1),
})

/** What the signed-in user may do with one article (the API checks again). */
export type ArticlePermissions = {
  update: boolean
  delete: boolean
  submit: boolean
  publish: boolean
  /** Pick someone else's byline (editors and up). */
  changeAuthor: boolean
}

export type ArticleDto = VersionedDto<ArticleContent> & {
  id: string
  slug: string
  title: string
  /** True while the site shows a published version. */
  live: boolean
  category: { id: string; slug: string; name: string }
  author: { id: string; name: string; title: string | null } | null
  scheduledAt: string | null
  /** Of the published body (what the site shows); null without a body. */
  readTimeMinutes: number | null
  createdAt: string
  permissions: ArticlePermissions
}

export type ArticleListItem = Omit<ArticleDto, "draft" | "published">

export type ArticleOptions = {
  categories: { id: string; slug: string; name: string }[]
  /** Possible bylines (only for users who may change them; else empty). */
  authors: { id: string; name: string; title: string | null }[]
  /**
   * Slugs the blog page features (draft or published): such an article
   * cannot be unpublished, deleted or moved (409), so the editor says why.
   * Always sent by the API (optional for older fixtures).
   */
  featured?: string[]
}
