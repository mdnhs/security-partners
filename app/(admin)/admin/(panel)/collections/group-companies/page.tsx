import type { Metadata } from "next"
import { Suspense } from "react"

import { CollectionScreen } from "@/components/admin/collections/collection-screen"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Group companies" }

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  await requirePermission({ collection: ["read"] })
  return <CollectionScreen name="group-companies" />
}
