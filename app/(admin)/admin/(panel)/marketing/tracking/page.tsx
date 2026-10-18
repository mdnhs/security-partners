import type { Metadata } from "next"
import { Suspense } from "react"

import { TrackingNotice } from "@/components/admin/marketing/notices"
import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"
import { GROWTH_SETTINGS } from "@/lib/admin/growth-settings"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Tracking" }

export default function TrackingPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePermission(GROWTH_SETTINGS.tracking.read)
  return (
    <GrowthSettingsEditor
      settingsKey="tracking"
      backHref="/admin"
      backLabel="Dashboard"
      aside={<TrackingNotice />}
    />
  )
}
