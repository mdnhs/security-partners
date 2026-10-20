import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { type QaFinding, scanContent } from "@/lib/content/qa"
import type { SeoHealthDto } from "@/lib/schemas/api/seo"
import { PUBLIC_SETTINGS_KEYS } from "@/lib/schemas/settings"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import { computeSeoHealth } from "@/server/modules/seo/service"
import { PAGE_KEYS } from "@/templates/registry"

import * as repo from "./repo"

/**
 * Cached readers behind the dashboard's SEO health and content QA (D3.5
 * review M3): both scan every record, so they are computed once and
 * shared by every dashboard load and the assistant's dashboard tool.
 *
 * They expire with each publish, unpublish and delete (the public tags
 * the versioning store and the modules already expire), each SEO save and
 * each media change (tag.contentReview). Draft saves never expire caches
 * (they leave the site untouched), so a draft-only change shows within
 * the "minutes" profile's revalidate window (about a minute).
 *
 * Neither takes the actor: callers check permissions first and pass the
 * readable scope as plain data (part of the cache key).
 */
function contentTags() {
  cacheLife("minutes")
  cacheTag(
    tag.contentReview,
    tag.services,
    tag.articles,
    tag.builderPages,
    ...PAGE_KEYS.map((key) => tag.page(key)),
    ...PUBLIC_SETTINGS_KEYS.map((key) => tag.settings(key))
  )
}

/** SEO health for seo:read callers (the SEO screen's own figures). */
export async function cachedSeoHealth(): Promise<SeoHealthDto> {
  "use cache"
  contentTags()
  return computeSeoHealth()
}

export type QaScope = {
  pages: boolean
  services: boolean
  /** Public settings keys the caller may read, in tab order. */
  settingsKeys: string[]
}

/** Content QA over exactly the given scope. */
export async function cachedQa(scope: QaScope): Promise<QaFinding[]> {
  "use cache"
  contentTags()
  const sources = await repo.qaSources(getDb(), scope)
  // Settings in their tab order, whatever order the rows came back in.
  const byKey = new Map(sources.settings.map((row) => [row.key, row.data]))
  return scanContent({
    settings: Object.fromEntries(
      scope.settingsKeys
        .filter((key) => byKey.has(key))
        .map((key) => [key, byKey.get(key)])
    ),
    pages: sources.pages,
    services: sources.services,
    builderPages: sources.builderPages,
  })
}
