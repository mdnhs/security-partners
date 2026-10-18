import type { Metadata } from "next"
import { Suspense } from "react"

import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"
import { GROWTH_SETTINGS } from "@/lib/admin/growth-settings"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "SEO defaults" }

export default function SeoDefaultsPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePermission(GROWTH_SETTINGS["seo.defaults"].read)
  return (
    <GrowthSettingsEditor
      settingsKey="seo.defaults"
      backHref="/admin/seo"
      backLabel="SEO overview"
    />
  )
}
