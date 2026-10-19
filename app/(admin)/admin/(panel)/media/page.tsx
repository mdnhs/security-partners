import type { Metadata } from "next"
import { Suspense } from "react"

import { MediaLibrary } from "@/components/admin/media/library"
import { PageHeader } from "@/components/admin/page-header"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Media" }

export default function MediaPage() {
  return (
    <Suspense fallback={null}>
      <Media />
    </Suspense>
  )
}

async function Media() {
  await requirePage("/admin/media")
  return (
    <>
      <PageHeader
        title="Media"
        description="Images and PDFs used across the site."
      />
      <MediaLibrary />
    </>
  )
}
