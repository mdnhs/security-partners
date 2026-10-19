import type { Metadata } from "next"
import { Suspense } from "react"

import { RedirectsScreen } from "@/components/admin/seo/redirects-screen"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Redirects" }

export default function RedirectsPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePage("/admin/seo/redirects")
  return <RedirectsScreen />
}
