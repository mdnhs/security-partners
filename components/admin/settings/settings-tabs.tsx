"use client"

import { type ReactNode, useMemo } from "react"

import { SectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { useAdminSession } from "@/components/admin/session-provider"
import {
  readableSettingsKeys,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import { hasPermission } from "@/lib/auth/permissions"

/**
 * Settings keys as route tabs on the left, each listed only when the user
 * may read it (the key's own `read` permission, which its page also checks);
 * the key's editor on the right. There is no overview: /admin/settings
 * redirects to the first readable key. Integrations (owner/admin,
 * integration:read) is the last tab, current on each integration's page.
 */
export function SettingsTabs({ children }: { children: ReactNode }) {
  const { roles } = useAdminSession()
  const items = useMemo(
    () => [
      ...readableSettingsKeys(roles).map((key) => ({
        id: key,
        label: SETTINGS_ENTRIES[key].label,
        href: `/admin/settings/${key}`,
      })),
      ...(hasPermission(roles, { integration: ["read"] })
        ? [
            {
              id: "integrations",
              label: "Integrations",
              href: "/admin/settings/integrations",
            },
          ]
        : []),
    ],
    [roles]
  )
  if (items.length === 0) return <>{children}</>
  return (
    <SectionTabs ariaLabel="Settings" heading="Settings" items={items}>
      {children}
    </SectionTabs>
  )
}
