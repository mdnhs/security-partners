import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { siteThemeCss } from "@/lib/theme/css"
import { getPreviewableSiteTheme } from "@/server/modules/theme/queries"

/**
 * The public site's brand overrides (:root), the draft for a verified
 * previewer. The default theme emits nothing, so globals.css stands as is.
 * Fails closed: any error renders nothing rather than breaking the page.
 */
export async function SiteThemeStyle() {
  await connection()
  let css: string
  try {
    css = siteThemeCss(await getPreviewableSiteTheme())
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
  return css ? <style id="site-theme">{css}</style> : null
}
