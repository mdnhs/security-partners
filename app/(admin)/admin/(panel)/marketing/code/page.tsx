import type { Metadata } from "next"
import { Suspense } from "react"

import { SnippetsEditor } from "@/components/admin/marketing/snippets-editor"
import { GROWTH_SETTINGS } from "@/lib/admin/growth-settings"
import { requirePermission } from "@/server/auth/session"
import { getPublishedSettings } from "@/server/modules/settings/queries"

export const metadata: Metadata = { title: "Custom code" }

export default function MarketingCodePage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

/** Owner only (customCode:read); others get the admin forbidden.tsx. */
async function Editor() {
  await requirePermission(GROWTH_SETTINGS.customCode.read)
  const live = await getPublishedSettings("customCode")
  return (
    <SnippetsEditor
      killSwitchOn={live?.disabled === true}
      description="Snippets for the public site: a script address or HTML, the pages it runs on and the consent it needs. Changes stay in a draft until you publish."
    />
  )
}
