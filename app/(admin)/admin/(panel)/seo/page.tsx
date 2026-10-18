import type { Metadata } from "next"
import { Suspense } from "react"

import { SeoOverview } from "@/components/admin/seo/seo-overview"
import { requirePermission } from "@/server/auth/session"
import { getSiteOrigin } from "@/server/modules/seo/queries"

export const metadata: Metadata = { title: "SEO" }

export default function SeoPage() {
  return (
    <Suspense fallback={null}>
      <Overview />
    </Suspense>
  )
}

async function Overview() {
  await requirePermission({ seo: ["read"] })
  // The published settings.site.productionUrl's origin (as the sitemap uses).
  return <SeoOverview origin={await getSiteOrigin()} />
}
