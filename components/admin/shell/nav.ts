import {
  Building2,
  FileText,
  Images,
  LayoutDashboard,
  Layers,
  type LucideIcon,
  Megaphone,
  Newspaper,
  ScrollText,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  UserRound,
  Users,
  Wrench,
} from "lucide-react"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"

/** Live counts shown beside nav items (Leads arrives in Phase 7). */
export type NavBadgeKey = "new-leads"
export type NavBadges = Partial<Record<NavBadgeKey, number>>

export type NavChild = {
  label: string
  href: string
  /** ⌘K's icon for the sub-page (the parent's when absent). */
  icon?: LucideIcon
  /** null = every signed-in user. */
  permission: PermissionRequest | null
}

/** Stable handles for items other code looks up (labels may change). */
export type NavItemId = "collections"

export type NavItem = {
  /** Set when other code (e.g. the Collections tabs) needs to find the item. */
  id?: NavItemId
  label: string
  href: string
  icon: LucideIcon
  /** null = every signed-in user. Items are hidden without read permission (spec §8.1). */
  permission: PermissionRequest | null
  /** "exact" for /admin (otherwise every admin URL would match). */
  match: "exact" | "prefix"
  /** Which count from NavBadges (if any) to show beside the label. */
  badge?: NavBadgeKey
  /** Sub-pages, shown as SectionTabs inside the content panel (JW). */
  children?: NavChild[]
  /** Drawn as an icon button in the sidebar's footer dock, not in the menu. */
  dock?: true
}

export type NavSection = { label: string; items: NavItem[] }

export type NavDestination = {
  label: string
  href: string
  icon: LucideIcon
  /** The section item a sub-page belongs to (⌘K shows it as context). */
  parent: string | null
}

const COLLECTION = { collection: ["read"] } satisfies PermissionRequest

/**
 * Admin IA (spec §8.1) in the James Whitfield structure: the sidebar lists
 * sections; a section's sub-pages are tabs in the content panel; account
 * and administration links (Users, Audit log — ruling D3) sit in the footer
 * dock. Later phases add their items here (Leads, SEO,
 * Marketing).
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
        label: "Articles",
        href: "/admin/articles",
        icon: Newspaper,
        permission: { article: ["read"] },
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
        id: "collections",
        label: "Collections",
        href: "/admin/team",
        icon: Layers,
        permission: COLLECTION,
        match: "prefix",
        children: [
          {
            label: "Team",
            href: "/admin/team",
            icon: Users,
            permission: COLLECTION,
          },
          {
            label: "Clients",
            href: "/admin/clients",
            icon: ShieldCheck,
            permission: COLLECTION,
          },
          {
            label: "Group companies",
            href: "/admin/group-companies",
            icon: Building2,
            permission: COLLECTION,
          },
          {
            label: "Categories",
            href: "/admin/categories",
            icon: Tags,
            permission: COLLECTION,
          },
        ],
      },
      {
        label: "Media",
        href: "/admin/media",
        icon: Images,
        permission: { media: ["read"] },
        match: "prefix",
      },
    ],
  },
  {
    // Phase 8 (04b "Patterns for later phases"): SEO and Marketing, each a
    // section whose sub-pages are route tabs.
    label: "Growth",
    items: [
      {
        label: "Marketing",
        href: "/admin/marketing/tracking",
        icon: Megaphone,
        permission: { marketing: ["read"] },
        match: "prefix",
        children: [
          {
            label: "Tracking",
            href: "/admin/marketing/tracking",
            permission: { marketing: ["read"] },
          },
          {
            label: "Consent banner",
            href: "/admin/marketing/consent",
            permission: { marketing: ["read"] },
          },
          {
            label: "Custom code",
            href: "/admin/marketing/custom-code",
            permission: { customCode: ["update"] },
          },
        ],
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
    label: "Administration",
    items: [
      {
        label: "Users",
        href: "/admin/users",
        icon: UserCog,
        permission: { user: ["read"] },
        match: "prefix",
        dock: true,
      },
      {
        label: "Audit log",
        href: "/admin/audit",
        icon: ScrollText,
        permission: { audit: ["read"] },
        match: "prefix",
        dock: true,
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
        dock: true,
      },
    ],
  },
]

const allowed = (
  roles: readonly string[],
  permission: PermissionRequest | null
) => permission === null || hasPermission(roles, permission)

/** The sections and items `roles` may see (children filtered); empty ones dropped. */
export function navItems(roles: readonly string[]): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    label: section.label,
    items: section.items.flatMap((item): NavItem[] => {
      if (!allowed(roles, item.permission)) return []
      if (!item.children) return [item]
      const children = item.children.filter((child) =>
        allowed(roles, child.permission)
      )
      if (children.length === 0) return []
      // The parent opens its first visible sub-page.
      return [{ ...item, href: children[0]!.href, children }]
    }),
  })).filter((section) => section.items.length > 0)
}

/** The sidebar menu: navItems without the dock's items. */
export function menuSections(roles: readonly string[]): NavSection[] {
  return navItems(roles)
    .map((section) => ({
      label: section.label,
      items: section.items.filter((item) => !item.dock),
    }))
    .filter((section) => section.items.length > 0)
}

/** Footer-dock links: Users, Audit log (owners/admins) and Account. */
export function dockItems(roles: readonly string[]): NavItem[] {
  return navItems(roles).flatMap((section) =>
    section.items.filter((item) => item.dock)
  )
}

/** Every page a role can open from the navigation, sub-pages flattened (⌘K). */
export function navDestinations(roles: readonly string[]): NavDestination[] {
  return navItems(roles).flatMap((section) =>
    section.items.flatMap((item): NavDestination[] =>
      item.children
        ? item.children.map((child) => ({
            label: child.label,
            href: child.href,
            icon: child.icon ?? item.icon,
            parent: item.label,
          }))
        : [
            {
              label: item.label,
              href: item.href,
              icon: item.icon,
              parent: null,
            },
          ]
    )
  )
}

/** The item `id` names, as `roles` may see it (children filtered), if any. */
export function findNavItem(
  roles: readonly string[],
  id: NavItemId
): NavItem | undefined {
  return navItems(roles)
    .flatMap((section) => section.items)
    .find((item) => item.id === id)
}

const covers = (href: string, pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/** True when `pathname` is this item's page, below it, or one of its sub-pages. */
export function isActiveItem(item: NavItem, pathname: string): boolean {
  if (item.match === "exact") return pathname === item.href
  if (covers(item.href, pathname)) return true
  return (item.children ?? []).some((child) => covers(child.href, pathname))
}
