"use client"

import Link from "next/link"

import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import type { NavItem } from "@/lib/admin/nav"

/** "120" → "99+": the pill stays one width. */
export function formatBadge(count: number): string {
  return count > 99 ? "99+" : String(count)
}

/**
 * Muted label and icon; the active item gets a bold label and a filled
 * primary icon. In the icon rail the label turns sr-only (still the name).
 */
export const NAV_BUTTON =
  "h-10 gap-3 rounded-xl px-3 text-[15px] text-muted-foreground hover:bg-sidebar-accent/60 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span]:sr-only data-active:bg-transparent data-active:font-semibold data-active:text-foreground [&_svg]:size-5 data-active:[&_svg]:fill-primary/15 data-active:[&_svg]:text-primary"

/** One sidebar link: icon, label (a tooltip in the icon rail), optional count. */
export function NavEntry({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  badge?: number
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <SidebarMenuItem>
      {/* The 4 px active bar on the panel's edge (the group's p-2 away). */}
      {active ? (
        <span
          aria-hidden
          data-slot="nav-active-bar"
          className="absolute top-1/2 -left-2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-primary"
        />
      ) : null}
      <SidebarMenuButton
        size="lg"
        isActive={active}
        tooltip={item.label}
        className={NAV_BUTTON}
        render={
          <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
          />
        }
      >
        <Icon aria-hidden />
        <span>{item.label}</span>
      </SidebarMenuButton>
      {badge && item.badgeLabel ? (
        <SidebarMenuBadge
          role="img"
          aria-label={`${badge} ${item.badgeLabel}`}
          className="top-3! right-2 h-6 rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground"
        >
          {formatBadge(badge)}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  )
}
