import type { Metadata } from "next"
import { Suspense } from "react"

import { NewsletterView } from "@/components/admin/newsletter/newsletter-view"
import { requirePermission } from "@/server/auth/session"
import { readPublishedSettings } from "@/server/modules/settings/service"

export const metadata: Metadata = { title: "Newsletter" }

export default function NewsletterPage() {
  return (
    <Suspense fallback={null}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  // Same rule as the nav registry's entry (permissionFor("/admin/newsletter")).
  // With MK Phase B this becomes requirePage("/admin/newsletter").
  await requirePermission({ newsletter: ["read"] })
  // Only for the empty state's "turn on a placement" hint.
  const settings = await readPublishedSettings("newsletter").catch(() => null)
  return <NewsletterView placement={settings?.placement ?? null} />
}
