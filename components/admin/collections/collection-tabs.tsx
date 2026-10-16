"use client"

import type { ReactNode } from "react"

import { SectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { useAdminSession } from "@/components/admin/session-provider"
import { findNavItem } from "@/components/admin/shell/nav"

/**
 * The Collections section's sub-pages as left route tabs (JW: the sidebar
 * lists sections; a section's pages are tabs in the content panel).
 */
export function CollectionTabs({ children }: { children: ReactNode }) {
  const { roles } = useAdminSession()
  const collections = findNavItem(roles, "collections")
  const items = (collections?.children ?? []).map((child) => ({
    id: child.href,
    label: child.label,
    href: child.href,
  }))
  if (items.length === 0) return <>{children}</>
  return (
    <SectionTabs ariaLabel="Collections" items={items}>
      {children}
    </SectionTabs>
  )
}
