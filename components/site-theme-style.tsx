import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { siteThemeCss } from "@/lib/theme/css"
import type { SiteThemeConfig } from "@/lib/theme/schema"
import {
  getPreviewableSiteTheme,
  getPublishedTheme,
} from "@/server/modules/theme/queries"

/** The previewable theme; if that fails (e.g. the preview check), the published one. */
async function siteTheme(): Promise<SiteThemeConfig> {
  try {
    return await getPreviewableSiteTheme()
  } catch (error) {
    unstable_rethrow(error)
    return (await getPublishedTheme()).site
  }
}

/**
 * The public site's brand overrides (:root), the draft for a verified
 * previewer. The default theme emits nothing, so globals.css stands as is.
 * Fails closed: any error renders nothing rather than breaking the page.
 */
export async function SiteThemeStyle({
  id = "site-theme",
}: { id?: string } = {}) {
  await connection()
  let css: string
  try {
    css = siteThemeCss(await siteTheme())
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
  return css ? <style id={id}>{css}</style> : null
}
