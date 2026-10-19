import type { Metadata } from "next"
import { Suspense } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { NewPageButton, PagesList } from "@/components/admin/pages/pages-list"
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
        description="Every page of the site. Changes stay in a draft until you publish."
        actions={<NewPageButton />}
      />
      <PagesList />
    </>
  )
}
