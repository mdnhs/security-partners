import type { Metadata } from "next"
import { Suspense } from "react"

import { CanonicalScreen } from "@/components/admin/seo/canonical-screen"
import { requirePage } from "@/server/auth/session"
import { getSiteOrigin } from "@/server/modules/seo/queries"

export const metadata: Metadata = { title: "Canonical URLs" }

export default function CanonicalPage() {
  return (
    <Suspense fallback={null}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePage("/admin/seo/canonical")
  // The published settings.site.productionUrl's origin (as the sitemap uses).
  return <CanonicalScreen origin={await getSiteOrigin()} />
}
