import type { Metadata } from "next"
import { Suspense } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { SettingsOverview } from "@/components/admin/settings/settings-overview"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <Settings />
    </Suspense>
  )
}

async function Settings() {
  await requirePermission({ settings: ["read"] })
  return (
    <>
      <PageHeader
        title="Settings"
        description="Site-wide details and the sections shared by several pages. Changes go live when you publish them."
      />
      <SettingsOverview />
    </>
  )
}
