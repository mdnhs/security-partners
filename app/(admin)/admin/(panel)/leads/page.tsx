import type { Metadata } from "next"
import { Suspense } from "react"

import { LeadsScreen } from "@/components/admin/leads/leads-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Leads" }

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ lead: ["read"] })
  return <LeadsScreen />
}
