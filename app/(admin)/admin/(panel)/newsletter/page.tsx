import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { NewsletterView } from "@/components/admin/newsletter/newsletter-view"
import { requirePermission } from "@/server/auth/session"
import { readPublishedSettings } from "@/server/modules/settings/service"

export const metadata: Metadata = { title: "Newsletter" }

export default function NewsletterPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Screen />
    </Suspense>
  )
}

async function Screen() {
  // Same rule as the nav registry's entry (permissionFor("/admin/newsletter")).
  // With MK Phase B this becomes requirePage("/admin/newsletter").
  await requirePermission({ newsletter: ["read"] })
  // For the empty state's "turn on a placement" hint. A read error goes to
  // the panel's error boundary rather than posing as "placement off".
  const settings = await readPublishedSettings("newsletter")
  return <NewsletterView placement={settings?.placement ?? null} />
}
