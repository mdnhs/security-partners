import { cookies } from "next/headers"
import { Suspense } from "react"

import { AdminShell } from "@/components/admin/shell/admin-shell"
import { SIDEBAR_COOKIE } from "@/components/admin/shell/constants"
import { requireSession } from "@/server/auth/session"
import { getEnv } from "@/server/env"
import { getSiteEnv } from "@/server/lib/site-env"
import { getSettings } from "@/server/modules/settings/queries"

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
  const [{ user, actor, session }, cookieStore, site] = await Promise.all([
    requireSession(),
    cookies(),
    getSettings("site"),
  ])
  const productionUrl = site?.productionUrl ?? undefined
  return (
    <AdminShell
      // Set by the sidebar toggle (components/ui/sidebar.tsx).
      defaultSidebarOpen={cookieStore.get(SIDEBAR_COOKIE)?.value !== "false"}
      site={{
        // The configured public origin; this deployment's own until set.
        url: productionUrl ?? new URL(getEnv().BETTER_AUTH_URL).origin,
        env: getSiteEnv(productionUrl),
      }}
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
