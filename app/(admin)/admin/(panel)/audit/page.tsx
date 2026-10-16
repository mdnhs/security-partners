import type { Metadata } from "next"
import { Suspense } from "react"

import { AuditScreen } from "@/components/admin/audit/audit-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Audit log" }

export default function AuditPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ audit: ["read"] })
  return <AuditScreen />
}
