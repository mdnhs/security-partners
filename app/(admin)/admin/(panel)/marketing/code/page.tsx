import type { Metadata } from "next"
import { Suspense } from "react"

import { SnippetsEditor } from "@/components/admin/marketing/snippets-editor"
import { requirePage } from "@/server/auth/session"
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
  await requirePage("/admin/marketing/code")
  const live = await getPublishedSettings("customCode")
  return (
    <SnippetsEditor
      killSwitchOn={live?.disabled === true}
      description="Snippets for the public site: a script address or HTML, the pages it runs on and the consent it needs. Changes stay in a draft until you publish."
    />
  )
}
