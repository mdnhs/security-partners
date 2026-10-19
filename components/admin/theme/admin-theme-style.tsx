import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { adminThemeCss } from "@/lib/theme/css"
import type { AdminThemeConfig } from "@/lib/theme/schema"
import { getPublishedTheme } from "@/server/modules/theme/queries"

import { DefaultMode } from "./default-mode"

/**
 * The published admin theme: the default mode, and token overrides for
 * html[data-admin] (light) / html[data-admin].dark. The default theme emits
 * no <style>. Never the draft; on any error, nothing (admin.css stands).
 */
export async function AdminThemeStyle() {
  await connection()
  let admin: AdminThemeConfig
  let css: string
  try {
    admin = (await getPublishedTheme()).admin
    css = adminThemeCss(admin)
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
  return (
    <>
      <DefaultMode mode={admin.mode} />
      {css ? <style id="theme-tokens">{css}</style> : null}
    </>
  )
}
