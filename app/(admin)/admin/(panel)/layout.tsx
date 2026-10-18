import { cookies } from "next/headers"
import { Suspense } from "react"

import { AdminShell } from "@/components/admin/shell/admin-shell"
import { SIDEBAR_COOKIE } from "@/components/admin/shell/constants"
import type { NavBadges } from "@/components/admin/shell/nav"
import { hasPermission } from "@/lib/auth/permissions"
import { requireSession } from "@/server/auth/session"
import { getEnv } from "@/server/env"
import { getSiteEnv } from "@/server/lib/site-env"
import { leadBadge } from "@/server/modules/leads/service"
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
  // Session first: it reads the request, so nothing below (the settings
  // query needs the database) runs while the route is being prerendered.
  const { user, actor, session } = await requireSession()
  // Sidebar counts: unassigned new leads for those who handle them. Fresh
  // on every navigation and on router.refresh() after a lead changes.
  const [cookieStore, site, badges] = await Promise.all([
    cookies(),
    getSettings("site"),
    hasPermission(actor.roles, { lead: ["read"] })
      ? leadBadge(actor).then((badge): NavBadges => ({
          "new-leads": badge.newLeads,
        }))
      : ({} satisfies NavBadges),
  ])
  const productionUrl = site?.productionUrl ?? undefined
  return (
    <AdminShell
      // Set by the sidebar toggle (components/ui/sidebar.tsx).
      defaultSidebarOpen={cookieStore.get(SIDEBAR_COOKIE)?.value !== "false"}
      badges={badges}
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
