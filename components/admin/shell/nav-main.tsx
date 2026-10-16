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

import { isActiveItem, menuSections, type NavBadges } from "./nav"
import { NavEntry } from "./nav-entry"

/** The permission-filtered admin navigation, one labelled group per section. */
export function NavMain({ badges = {} }: { badges?: NavBadges }) {
  const pathname = usePathname()
  const { roles } = useAdminSession()
  const { isMobile, setOpenMobile } = useSidebar()
  const idPrefix = useId()
  // The mobile sheet stays open on navigation otherwise.
  const onNavigate = isMobile ? () => setOpenMobile(false) : undefined
  return (
    <nav aria-label="Admin">
      {menuSections(roles).map((section, index) => {
        const labelId = `${idPrefix}-section-${index}`
        return (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel
              id={labelId}
              className="font-bold tracking-[0.08em] text-sidebar-foreground/60 uppercase"
            >
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-labelledby={labelId} className="gap-0.5">
                {section.items.map((item) => (
                  <NavEntry
                    key={item.href}
                    item={item}
                    active={isActiveItem(item, pathname)}
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
