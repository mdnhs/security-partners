import type { Metadata } from "next"
import { Suspense } from "react"

import { CustomCodeNotice } from "@/components/admin/marketing/notices"
import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"
import { GROWTH_SETTINGS } from "@/lib/admin/growth-settings"
import { requirePermission } from "@/server/auth/session"

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
  return (
    <GrowthSettingsEditor
      settingsKey="customCode"
      aside={<CustomCodeNotice />}
    />
  )
}
