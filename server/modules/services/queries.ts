import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import type { Seo } from "@/lib/schemas/common"
import type { ServiceContent } from "@/lib/schemas/content/service"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"

import { findServiceBySlug, listServiceRows } from "./repo"

export type ServiceRecord = {
  id: string
  slug: string
  sortOrder: number
  seo: Seo
  content: ServiceContent
}

type Row = Awaited<ReturnType<typeof findServiceBySlug>>

function toRecord(row: NonNullable<Row>, draft: boolean): ServiceRecord | null {
  const content = draft ? row.draft : row.published
  if (!content) return null
  return {
    id: row.id,
    slug: row.slug,
    sortOrder: row.sortOrder,
    seo: row.seo,
    content,
  }
}

/** Published services in display order. */
export async function listServices(): Promise<ServiceRecord[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.services)
  const { isEnabled: draft } = await draftMode()
  const rows = await listServiceRows(getDb())
  return rows
    .map((row) => toRecord(row, draft))
    .filter((r): r is ServiceRecord => r !== null)
}

/** One published service; null for an unknown or unpublished slug. */
export async function getService(slug: string): Promise<ServiceRecord | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.services, tag.service(slug))
  const { isEnabled: draft } = await draftMode()
  const row = await findServiceBySlug(getDb(), slug)
  return row ? toRecord(row, draft) : null
}
