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

/** A missing or no-longer-valid value reads as the default theme (no <style>). */
function parseTheme(value: unknown): ThemeConfigValue {
  const parsed = ThemeConfig.safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_THEME
}

/** The live theme (admin and public site). Never the draft. */
export async function getPublishedTheme(): Promise<ThemeConfigValue> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.settings("theme"))
  const row = await findSettingsRow(getDb(), "theme")
  return parseTheme(row?.published)
}

/**
 * The public site's theme: the draft for a verified previewer (read
 * uncached, per request), else the published one.
 */
export async function getPreviewableSiteTheme(): Promise<SiteThemeConfig> {
  if (await isPreviewing()) {
    const row = await findSettingsRow(getDb(), "theme")
    return parseTheme(row?.draft).site
  }
  return (await getPublishedTheme()).site
}
