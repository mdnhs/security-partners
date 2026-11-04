import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { cache } from "react"

import { isLegalSlug } from "@/lib/legal-slug"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import { previewerCan } from "@/server/modules/preview/guard"
import { isPublishedSlug } from "@/server/modules/redirects/repo"
import type { LegalTemplate } from "@/templates/legal/schema"

import * as repo from "./repo"

export type PublishedLegalPage = {
  id: string
  title: string
  doc: LegalTemplate
  /** The page's "last updated": when it was last published. */
  updatedAt: Date
}

/**
 * The live page at /<slug>, or its draft when `draft`; null if missing or
 * (live) never published. Callers decide `draft` with getLegalPageForRequest.
 */
export async function getPublishedLegalPage(
  slug: string,
  draft = false
): Promise<PublishedLegalPage | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.legalPages, tag.legalPage(slug))
  const row = await repo.findLegalPageBySlug(getDb(), slug)
  if (!row) return null
  const doc = (draft ? row.draft : row.published) as LegalTemplate | null
  if (!doc) return null
  return {
    id: row.id,
    title: row.title,
    doc,
    updatedAt: row.publishedAt ?? row.updatedAt,
  }
}

/**
 * What /<slug> shows this request: the draft only to a previewer holding
 * page:read, else the published page. Malformed, unreserved-looking junk,
 * unknown and unpublished slugs never reach the cache ("use cache" lives
 * "max", so probes must not mint entries). React cache(): generateMetadata
 * and the page body share one lookup per request.
 */
export const getLegalPageForRequest = cache(
  async (slug: string): Promise<PublishedLegalPage | null> => {
    if (!isLegalSlug(slug)) return null
    const draft = await previewerCan({ page: ["read"] })
    if (!draft && !(await isPublishedLegalSlug(slug))) return null
    return getPublishedLegalPage(slug, draft)
  }
)

/** Is /<slug> live? A plain read (not cached), shared with proxy.ts. */
export function isPublishedLegalSlug(slug: string): Promise<boolean> {
  return isPublishedSlug(getDb(), "legal", slug)
}

export type LegalLink = { slug: string; title: string }

/**
 * The footer's legal links: published pages in admin order. It throws when
 * the database is unreachable and a thrown 'use cache' entry is never stored,
 * so a failure cannot be cached as "no legal pages"; callers choose the
 * fallback (see listLegalLinks in pages/sources.ts).
 */
export async function getLegalLinks(): Promise<LegalLink[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.legalPages)
  return repo.listPublishedLegalLinks(getDb())
}
