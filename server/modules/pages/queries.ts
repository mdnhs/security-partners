import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import type { Seo } from "@/lib/schemas/common"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import type { PageData, PageKey } from "@/templates/registry"

import { findPageByKey } from "./repo"

export type PageRecord<K extends PageKey> = {
  key: K
  data: PageData<K>
  seo: Seo
}

/** Published page data (draft in draft mode); null if missing or never published. */
export async function getPage<K extends PageKey>(
  key: K
): Promise<PageRecord<K> | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.page(key))
  const { isEnabled: draft } = await draftMode()
  const row = await findPageByKey(getDb(), key)
  const data = draft ? row?.draft : row?.published
  if (!row || !data) return null
  return { key, data: data as PageData<K>, seo: row.seo }
}
