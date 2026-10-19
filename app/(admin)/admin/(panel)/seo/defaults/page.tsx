import type { Metadata } from "next"
import { Suspense } from "react"

import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "SEO defaults" }

export default function SeoDefaultsPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePage("/admin/seo/defaults")
  // Inside the SEO route tabs: no back link (the Overview tab is beside it).
  return <GrowthSettingsEditor settingsKey="seo.defaults" />
}
