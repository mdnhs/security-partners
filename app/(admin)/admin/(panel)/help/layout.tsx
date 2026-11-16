import { Suspense } from "react"

import { HelpShell } from "@/components/admin/help/help-view"
import { HelpPageSkeleton } from "@/components/admin/kit/skeletons"
import { requirePage } from "@/server/auth/session"

/**
 * The topics sidebar lives here, not in each page, so moving between
 * articles keeps it mounted: open groups, the filter and its scroll stay.
 */
export default function HelpLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<HelpPageSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  )
}

async function Shell({ children }: { children: React.ReactNode }) {
  // Gated by HELP_LINK, as the pages are; the roles pick the topics shown.
  const actor = await requirePage("/admin/help")
  return <HelpShell roles={actor.roles}>{children}</HelpShell>
}
