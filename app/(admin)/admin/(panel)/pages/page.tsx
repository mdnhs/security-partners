import type { Metadata } from "next"
import { Suspense } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { PagesList } from "@/components/admin/pages/pages-list"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Pages" }

export default function PagesPage() {
  return (
    <Suspense fallback={null}>
      <Pages />
    </Suspense>
  )
}

async function Pages() {
  await requirePermission({ page: ["read"] })
  return (
    <>
      <PageHeader
        title="Pages"
        description="The eight fixed pages of the site. Layout and section order are part of the design; every text, image and link is editable."
      />
      <PagesList />
    </>
  )
}
