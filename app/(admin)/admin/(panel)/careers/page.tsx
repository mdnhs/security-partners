import type { Metadata } from "next"
import { Suspense } from "react"

import { JobsScreen } from "@/components/admin/careers/jobs-screen"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Jobs" }

export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePage("/admin/careers")
  return <JobsScreen />
}
