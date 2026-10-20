import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/components/admin/kit/skeletons"
import { NewsletterView } from "@/components/admin/newsletter/newsletter-view"
import { requirePage } from "@/server/auth/session"
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
  await requirePage("/admin/newsletter")
  // For the empty state's "turn on a placement" hint. A read error goes to
  // the panel's error boundary rather than posing as "placement off".
  const settings = await readPublishedSettings("newsletter")
  return <NewsletterView placement={settings?.placement ?? null} />
}
