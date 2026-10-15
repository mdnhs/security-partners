import {
  Building2,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  ShieldCheck,
  Tags,
  UserRound,
  Users,
  Wrench,
} from "lucide-react"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  /** null = every signed-in user. Items are hidden without read permission (spec §8.1). */
  permission: PermissionRequest | null
  /** "exact" for /admin (otherwise every admin URL would match). */
  match: "exact" | "prefix"
}

export type NavSection = { label: string; items: NavItem[] }

/**
 * Admin IA (spec §8.1) for the screens that exist. Later phases add their
 * items here (Articles, Media, Leads, SEO, Marketing, Users, Audit log).
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        permission: null,
        match: "exact",
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        label: "Pages",
        href: "/admin/pages",
        icon: FileText,
        permission: { page: ["read"] },
        match: "prefix",
      },
      {
        label: "Services",
        href: "/admin/services",
        icon: Wrench,
        permission: { service: ["read"] },
        match: "prefix",
      },
      {
        label: "Team",
        href: "/admin/team",
        icon: Users,
        permission: { collection: ["read"] },
        match: "prefix",
      },
      {
        label: "Clients",
        href: "/admin/clients",
        icon: ShieldCheck,
        permission: { collection: ["read"] },
        match: "prefix",
      },
      {
        label: "Group companies",
        href: "/admin/group-companies",
        icon: Building2,
        permission: { collection: ["read"] },
        match: "prefix",
      },
      {
        label: "Categories",
        href: "/admin/categories",
        icon: Tags,
        permission: { collection: ["read"] },
        match: "prefix",
      },
    ],
  },
  {
    label: "Configuration",
    items: [
      {
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
        permission: { settings: ["read"] },
        match: "prefix",
      },
    ],
  },
  {
    label: "You",
    items: [
      {
        label: "Account",
        href: "/admin/account",
        icon: UserRound,
        permission: null,
        match: "prefix",
      },
    ],
  },
]

/** The sections and items `roles` may see; empty sections are dropped. */
export function navItems(roles: readonly string[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    label: section.label,
    items: section.items.filter(
      (item) =>
        item.permission === null || hasPermission(roles, item.permission)
    ),
  })).filter((section) => section.items.length > 0)
}

/** True when `pathname` is this item's page (or below it, for "prefix"). */
export function isActiveItem(item: NavItem, pathname: string): boolean {
  if (item.match === "exact") return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
