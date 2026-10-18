import type { Metadata } from "next"
import { Suspense } from "react"

import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"
import { GROWTH_SETTINGS } from "@/lib/admin/growth-settings"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Consent banner" }

export default function ConsentPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePermission(GROWTH_SETTINGS.consent.read)
  return (
    <GrowthSettingsEditor
      settingsKey="consent"
      backHref="/admin/marketing/tracking"
      backLabel="Tracking"
    />
  )
}
