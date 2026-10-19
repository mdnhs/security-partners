import type { Metadata } from "next"
import { Suspense } from "react"

import { GrowthSettingsEditor } from "@/components/admin/seo/growth-settings-editor"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Consent banner" }

export default function ConsentPage() {
  return (
    <Suspense fallback={null}>
      <Editor />
    </Suspense>
  )
}

async function Editor() {
  await requirePage("/admin/marketing/consent")
  return <GrowthSettingsEditor settingsKey="consent" />
}
