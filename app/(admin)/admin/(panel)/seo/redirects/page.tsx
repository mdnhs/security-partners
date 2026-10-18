import type { Metadata } from "next"
import { Suspense } from "react"

import { RedirectsScreen } from "@/components/admin/seo/redirects-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Redirects" }

export default function RedirectsPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission({ redirect: ["read"] })
  return <RedirectsScreen />
}
