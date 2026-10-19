import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { cache } from "react"

import type { BuilderDocument } from "@/blocks/document"
import { BlockInstance } from "@/blocks/registry"
import { isBuilderSlug } from "@/lib/builder-slug"
import type { Seo } from "@/lib/schemas/common"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import { previewerCan } from "@/server/modules/preview/guard"
import { isPublishedSlug } from "@/server/modules/redirects/repo"

import * as repo from "./repo"

export type PublishedBuilderPage = {
  id: string
  title: string
  seo: Seo
  doc: BuilderDocument
  updatedAt: Date
}

/** Draft preview: blocks that do not validate yet are left out, never rendered broken. */
function looseDoc(draft: { blocks?: unknown }): BuilderDocument {
  const blocks = Array.isArray(draft.blocks) ? draft.blocks : []
  return {
    blocks: blocks.flatMap((block) => {
      const parsed = BlockInstance.safeParse(block)
      return parsed.success ? [parsed.data] : []
    }),
  }
}

/**
 * The live page at /p/<slug>, or its draft when `draft`; null if missing or
 * (live) never published. Callers decide `draft` with getBuilderPageForRequest.
 */
export async function getPublishedBuilderPage(
  slug: string,
  draft = false
): Promise<PublishedBuilderPage | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.builderPages, tag.builderPage(slug))
  const row = await repo.findBuilderPageBySlug(getDb(), slug)
  if (!row) return null
  const doc = draft
    ? looseDoc(row.draft)
    : (row.published as BuilderDocument | null)
  if (!doc) return null
  return {
    id: row.id,
    title: row.title,
    seo: row.seo,
    doc,
    updatedAt: row.updatedAt,
  }
}

/**
 * What /p/<slug> shows this request: the draft only to a previewer holding
 * page:read (an author previewing an article sees the published page, or
 * nothing), else the published page. Malformed, unknown and unpublished
 * slugs never reach the cache (re-review D5.2 M9): the 'use cache' entry
 * lives "max", so arbitrary /p/<junk> probes must not mint entries.
 * React cache(): generateMetadata and the page body share one lookup per
 * request (review D5.4 M6).
 */
export const getBuilderPageForRequest = cache(
  async (slug: string): Promise<PublishedBuilderPage | null> => {
    if (!isBuilderSlug(slug)) return null
    const draft = await previewerCan({ page: ["read"] })
    if (!draft && !(await isPublishedBuilderSlug(slug))) return null
    return getPublishedBuilderPage(slug, draft)
  }
)

/** Is /p/<slug> live? A plain read (not cached), shared with proxy.ts. */
export function isPublishedBuilderSlug(slug: string): Promise<boolean> {
  return isPublishedSlug(getDb(), "builder", slug)
}

/** A published builder page shows a newsletter block (D4 newsletterAcceptsSignups). */
export function newsletterBlockPublished(): Promise<boolean> {
  return repo.hasPublishedNewsletterBlock(getDb())
}
