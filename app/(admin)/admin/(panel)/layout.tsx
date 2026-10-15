import { Suspense } from "react"

import { AdminShell } from "@/components/admin/shell/admin-shell"
import { requireSession } from "@/server/auth/session"

/**
 * Signed-in admin frame (spec §8). The session is read fresh inside
 * Suspense (Cache Components: request data never in the static shell).
 */
export default function PanelLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={null}>
      <PanelFrame>{children}</PanelFrame>
    </Suspense>
  )
}

async function PanelFrame({ children }: { children: React.ReactNode }) {
  const { user, actor, session } = await requireSession()
  return (
    <AdminShell
      session={{
        user,
        roles: actor.roles,
        impersonatedBy: session.impersonatedBy,
      }}
    >
      {children}
    </AdminShell>
  )
}
