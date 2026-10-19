import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import type { BuilderDocument } from "@/blocks/document"
import { BlockInstance } from "@/blocks/registry"
import type { Seo } from "@/lib/schemas/common"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"

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

/** The live page at /p/<slug> (the draft in draft mode); null if missing or never published. */
export async function getPublishedBuilderPage(
  slug: string
): Promise<PublishedBuilderPage | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.builderPages, tag.builderPage(slug))
  const { isEnabled: draft } = await draftMode()
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

/** For proxy.ts: is /p/<slug> live? A plain repo read (not cached). */
export function isPublishedBuilderSlug(slug: string): Promise<boolean> {
  return repo.isPublishedBuilderSlug(getDb(), slug)
}

/** A published builder page shows a newsletter block (D4 newsletterAcceptsSignups). */
export function newsletterBlockPublished(): Promise<boolean> {
  return repo.hasPublishedNewsletterBlock(getDb())
}
