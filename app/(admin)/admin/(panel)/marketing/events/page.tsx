import type { Metadata } from "next"
import { Suspense } from "react"

import { EventsView } from "@/components/admin/marketing/events-view"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Event catalogue" }

export default function MarketingEventsPage() {
  return (
    <Suspense fallback={null}>
      <Catalogue />
    </Suspense>
  )
}

/** Marketing readers (the nav entry's permission). */
async function Catalogue() {
  await requirePermission({ marketing: ["read"] })
  return <EventsView />
}
