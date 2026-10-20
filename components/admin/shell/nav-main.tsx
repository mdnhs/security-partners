"use client"

import { usePathname } from "next/navigation"
import { useId } from "react"

import { useAdminSession } from "@/components/admin/session-provider"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar"

import { activeItem, type NavBadges, visibleNav } from "@/lib/admin/nav"

import { NavEntry } from "./nav-entry"

/**
 * The permission-filtered groups (Menu / Growth / General), one labelled
 * group each (JW sidebar). A section links to its first sub-page the user
 * may open and stays current on all of them.
 */
export function NavMain({ badges = {} }: { badges?: NavBadges }) {
  const pathname = usePathname()
  const { roles } = useAdminSession()
  const { isMobile, setOpenMobile } = useSidebar()
  const idPrefix = useId()
  // The mobile sheet stays open on navigation otherwise.
  const onNavigate = isMobile ? () => setOpenMobile(false) : undefined
  const current = activeItem(pathname, roles)?.id
  return (
    <nav aria-label="Admin">
      {visibleNav(roles).map((section, index) => {
        const labelId = `${idPrefix}-section-${index}`
        return (
          <SidebarGroup key={section.group} className="py-1">
            <SidebarGroupLabel
              id={labelId}
              className="h-7 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-labelledby={labelId} className="gap-0.5">
                {section.items.map((item) => (
                  <NavEntry
                    key={item.id}
                    item={{
                      ...item,
                      href: item.children?.[0]?.href ?? item.href,
                    }}
                    active={item.id === current}
                    badge={item.badge ? badges[item.badge] : undefined}
                    onNavigate={onNavigate}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )
      })}
    </nav>
  )
}
