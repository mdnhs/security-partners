import type { Metadata } from "next"
import { Suspense } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { PagesList } from "@/components/admin/pages/pages-list"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Pages" }

export default function PagesPage() {
  return (
    <Suspense fallback={null}>
      <Pages />
    </Suspense>
  )
}

async function Pages() {
  await requirePage("/admin/pages")
  return (
    <>
      <PageHeader
        title="Pages"
        description="Every page of the site. Changes stay in a draft until you publish."
      />
      <PagesList />
    </>
  )
}
