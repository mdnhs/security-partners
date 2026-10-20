import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import type { SettingsKey, SettingsValue } from "@/server/lib/settings-store"

import { findSettingsRow } from "./repo"
import { readPublishedSettings } from "./service"

/** Published value of a content settings key (draft in draft mode); null if unset. */
export async function getSettings<K extends SettingsKey>(
  key: K
): Promise<SettingsValue<K> | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.settings(key))
  const { isEnabled: draft } = await draftMode()
  const row = await findSettingsRow(getDb(), key)
  const value = draft ? row?.draft : row?.published
  return (value ?? null) as SettingsValue<K> | null
}

/**
 * Published value only, never the draft — not even in draft mode. For
 * public readers that must not leak unpublished copy: sitemap, robots, OG
 * cards, tracking/consent/custom code (ledger ruling). A cached wrapper of
 * readPublishedSettings (settings/service.ts): null when unpublished or no
 * longer schema-valid.
 */
export async function getPublishedSettings<K extends SettingsKey>(
  key: K
): Promise<SettingsValue<K> | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.settings(key))
  return readPublishedSettings(key)
}
