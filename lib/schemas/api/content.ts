import { z } from "zod"

import { PAGE_KEYS, type PageKey } from "@/templates/registry"

export const CONTENT_STATUSES = [
  "draft",
  "in_review",
  "scheduled",
  "published",
] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

/** Optimistic lock: the version the client last saw (spec §5.1). */
export const versionInput = z.object({ version: z.number().int().min(1) })

/** PUT …/draft. `draft` is validated by the service against the record's schema. */
export const draftInput = versionInput.extend({ draft: z.unknown() })

/** POST …/restore. */
export const restoreInput = versionInput.extend({ revisionId: z.uuid() })

export const pageKeyParam = z.object({
  key: z.enum(PAGE_KEYS as [PageKey, ...PageKey[]]),
})

/** Entity types that keep revision rows (revisions.entity_type). */
export const REVISION_ENTITIES = [
  "page",
  "service",
  "article",
  "settings",
  "team",
  "client",
  "groupCompany",
  "category",
] as const
export type RevisionEntity = (typeof REVISION_ENTITIES)[number]

export const revisionListParam = z.object({
  entity: z.enum(REVISION_ENTITIES),
  id: z.string().min(1).max(100),
})
export const revisionParam = revisionListParam.extend({
  revisionId: z.uuid(),
})

/** Wire shape of a versioned record (pages, services, settings). Dates are ISO UTC. */
export type VersionedDto<T> = {
  draft: T
  published: T | null
  version: number
  status: ContentStatus
  /** Draft differs from what the site shows. */
  dirty: boolean
  publishedAt: string | null
  updatedAt: string
  updatedBy: { id: string; name: string } | null
}

export type PageDto = VersionedDto<unknown> & {
  key: PageKey
  label: string
  template: string
  path: string
}

export type PageListItem = Omit<PageDto, "draft" | "published">

export type RevisionSummary = {
  id: string
  version: number
  createdAt: string
  actor: { id: string; name: string } | null
}

export type RevisionDetail = RevisionSummary & { data: unknown }
