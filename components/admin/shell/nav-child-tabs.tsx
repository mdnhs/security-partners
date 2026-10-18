"use client"

import type { ReactNode } from "react"

import { SectionTabs } from "@/components/admin/section-tabs/section-tabs"
import { useAdminSession } from "@/components/admin/session-provider"
import { navItems } from "@/components/admin/shell/nav"

const covers = (base: string, href: string) =>
  href === base || href.startsWith(`${base}/`)

/**
 * The sub-pages (permission-filtered `children`) of the nav item that owns
 * `basePath` as left route tabs — the JW pattern used by SEO and Marketing.
 * Matched by address, so renaming the item's label changes nothing here.
 */
export function NavChildTabs({
  basePath,
  children,
}: {
  /** The section's address prefix, e.g. "/admin/seo". */
  basePath: string
  children: ReactNode
}) {
  const { roles } = useAdminSession()
  const item = navItems(roles)
    .flatMap((s) => s.items)
    .find((i) => i.children?.some((child) => covers(basePath, child.href)))
  const items = (item?.children ?? []).map((child) => ({
    id: child.href,
    label: child.label,
    href: child.href,
  }))
  if (!item || items.length < 2) return <>{children}</>
  return (
    <SectionTabs ariaLabel={item.label} heading={item.label} items={items}>
      {children}
    </SectionTabs>
  )
}
