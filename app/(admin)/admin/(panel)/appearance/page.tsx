import type { Metadata } from "next"
import { Suspense } from "react"

import { AppearanceView } from "@/components/admin/appearance/appearance-view"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Appearance" }

export default function AppearancePage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePage("/admin/appearance")
  return <AppearanceView />
}
