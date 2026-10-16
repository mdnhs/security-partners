import type { Metadata } from "next"
import { Suspense } from "react"

import { ServicesScreen } from "@/components/admin/services/services-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Services" }

export default function ServicesPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ service: ["read"] })
  return <ServicesScreen />
}
