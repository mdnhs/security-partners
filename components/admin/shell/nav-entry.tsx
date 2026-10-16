"use client"

import Link from "next/link"

import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import type { NavItem } from "./nav"

/** "120" → "99+": the pill stays one width. */
export function formatBadge(count: number): string {
  return count > 99 ? "99+" : String(count)
}

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
      <SidebarMenuButton
        isActive={active}
        tooltip={item.label}
        className="data-active:shadow-[inset_3px_0_0_var(--sidebar-primary)]"
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
      {badge ? (
        <SidebarMenuBadge
          role="img"
          aria-label={`${badge} new ${item.label.toLowerCase()}`}
          className="rounded-full bg-sidebar-primary px-1.5 font-bold text-sidebar-primary-foreground"
        >
          {formatBadge(badge)}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  )
}
