import type { Metadata } from "next"
import { Suspense } from "react"

import { Showcase } from "@/components/admin/design/showcase"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Design system" }

export default function DesignPage() {
  return (
    <Suspense fallback={null}>
      <Design />
    </Suspense>
  )
}

// Owner only (customCode:update; others get the admin forbidden.tsx), and
// not in the menu: reached by URL. Phase B: requirePage("/admin/design").
async function Design() {
  await requirePermission({ customCode: ["update"] })
  return <Showcase />
}
