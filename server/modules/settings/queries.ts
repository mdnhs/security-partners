import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import type { SettingsKey, SettingsValue } from "@/server/lib/settings-store"

import { findSettingsRow } from "./repo"

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
