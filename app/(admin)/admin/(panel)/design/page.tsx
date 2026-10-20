import type { Metadata } from "next"
import { Suspense } from "react"

import { Showcase } from "@/components/admin/design/showcase"
import { requirePage } from "@/server/auth/session"

export const metadata: Metadata = { title: "Design system" }

export default function DesignPage() {
  return (
    <Suspense fallback={null}>
      <Design />
    </Suspense>
  )
}

// Owner only (the registry lists customCode:update; others get the admin
// forbidden.tsx), and not in the menu: reached by URL or ⌘K.
async function Design() {
  await requirePage("/admin/design")
  return <Showcase />
}
