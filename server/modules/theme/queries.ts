import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import {
  DEFAULT_THEME,
  type SiteThemeConfig,
  ThemeConfig,
  type ThemeConfigValue,
} from "@/lib/theme/schema"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import { isPreviewing } from "@/server/modules/preview/guard"
import { findSettingsRow } from "@/server/modules/settings/repo"

/**
 * A missing value reads as the default theme (no <style>). A stored value
 * that no longer parses (manual edit, schema drift) reads as the default
 * too, with a warning so a broken theme shows up in the logs. Only for
 * display: the versioned store keeps the raw value, so publishing a
 * corrupt draft fails validation instead of publishing the default.
 */
export function readThemeOrDefault(value: unknown): ThemeConfigValue {
  if (value === null || value === undefined) return DEFAULT_THEME
  const parsed = ThemeConfig.safeParse(value)
  if (parsed.success) return parsed.data
  console.warn(
    "[theme] stored theme invalid; using default",
    parsed.error.issues
  )
  return DEFAULT_THEME
}

/** The live theme (admin and public site). Never the draft. */
export async function getPublishedTheme(): Promise<ThemeConfigValue> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.settings("theme"))
  const row = await findSettingsRow(getDb(), "theme")
  return readThemeOrDefault(row?.published)
}

/**
 * The public site's theme: the draft for a verified previewer (read
 * uncached, per request), else the published one.
 */
export async function getPreviewableSiteTheme(): Promise<SiteThemeConfig> {
  if (await isPreviewing()) {
    const row = await findSettingsRow(getDb(), "theme")
    return readThemeOrDefault(row?.draft).site
  }
  return (await getPublishedTheme()).site
}
