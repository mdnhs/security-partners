import type { Metadata } from "next"
import { Suspense } from "react"

import { HelpOverview } from "@/components/admin/help/help-view"
import { HelpArticleSkeleton } from "@/components/admin/kit/skeletons"
import { requirePage } from "@/server/auth/session"
import { listOwnerContacts } from "@/server/modules/users/service"

export const metadata: Metadata = { title: "Help" }

export default function HelpPage() {
  return (
    <Suspense fallback={<HelpArticleSkeleton />}>
      <Overview />
    </Suspense>
  )
}

async function Overview() {
  const actor = await requirePage("/admin/help")
  // Deliberate (MK-parity B7 brief, controller ruling): every signed-in role,
  // including author and intake and an impersonated session, sees the active
  // owners' names and work emails here, though those roles cannot read
  // /admin/users. Only name and email are read; no API route serves them.
  const owners = await listOwnerContacts()
  return <HelpOverview roles={actor.roles} owners={owners} />
}
