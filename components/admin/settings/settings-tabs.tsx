"use client"

import { type ReactNode, useMemo } from "react"

import { SectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { useAdminSession } from "@/components/admin/session-provider"
import { findNavItem } from "@/components/admin/shell/nav"

/**
 * Site settings' children from the nav registry as route tabs on the left,
 * each listed only when the user may open it (the same permission its page
 * checks): one tab per settings key, then AI assistant and Integrations
 * (owner/admin, integration:read; Integrations is current on each
 * integration's page). There is no overview: /admin/settings redirects to
 * the first tab. B4 replaces this with the shell's single SectionTabs.
 */
export function SettingsTabs({ children }: { children: ReactNode }) {
  const { roles } = useAdminSession()
  const items = useMemo(
    () =>
      (findNavItem(roles, "settings")?.children ?? []).map((child) => ({
        id: child.id,
        label: child.label,
        href: child.href,
      })),
    [roles]
  )
  if (items.length === 0) return <>{children}</>
  return (
    <SectionTabs ariaLabel="Settings" heading="Settings" items={items}>
      {children}
    </SectionTabs>
  )
}
