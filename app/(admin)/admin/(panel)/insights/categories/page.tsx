import type { Metadata } from "next"
import { Suspense } from "react"

import { CollectionScreen } from "@/components/admin/collections/collection-screen"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Categories" }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePage("/admin/insights/categories")
  return <CollectionScreen name="categories" />
}
