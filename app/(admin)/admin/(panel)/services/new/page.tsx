import type { Metadata } from "next"
import { Suspense } from "react"

import { NewServiceForm } from "@/components/admin/services/new-service-form"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "New service" }

export default function NewServicePage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ service: ["create"] })
  return <NewServiceForm />
}
