"use client"

import type { ReactNode } from "react"

import { SectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { useAdminSession } from "@/components/admin/session-provider"
import { navItems } from "@/components/admin/shell/nav"

/**
 * A nav item's sub-pages (its `children`, permission-filtered) as left
 * route tabs — the JW pattern used by Collections, SEO and Marketing.
 */
export function NavChildTabs({
  section,
  children,
}: {
  section: string
  children: ReactNode
}) {
  const { roles } = useAdminSession()
  const item = navItems(roles)
    .flatMap((s) => s.items)
    .find((i) => i.label === section)
  const items = (item?.children ?? []).map((child) => ({
    id: child.href,
    label: child.label,
    href: child.href,
  }))
  if (items.length < 2) return <>{children}</>
  return (
    <SectionTabs ariaLabel={section} heading={section} items={items}>
      {children}
    </SectionTabs>
  )
}
