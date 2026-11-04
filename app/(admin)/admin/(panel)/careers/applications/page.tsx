import type { Metadata } from "next"
import { Suspense } from "react"

import { ApplicationsScreen } from "@/components/admin/careers/applications-screen"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Applications" }

export default function ApplicationsPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePage("/admin/careers/applications")
  return <ApplicationsScreen />
}
