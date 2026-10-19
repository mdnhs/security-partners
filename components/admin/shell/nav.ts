import {
  EXTRA_LINKS,
  HELP_LINK,
  type NavItem,
  type NavLink,
  NAV_ITEMS,
  reachableLinks,
  visibleNav,
} from "@/lib/admin/nav"
import { hasPermission } from "@/lib/auth/permissions"
import type { Role } from "@/lib/auth/roles"

import type { LucideIcon } from "lucide-react"

/**
 * Transitional bridge (MK parity B1 → B4): the registry lives in
 * `lib/admin/nav.ts`; these thin adapters keep the current shell, the
 * per-section tab layouts and the role e2e working until B4 switches them to
 * `visibleNav`/`dockLinks`/`reachableLinks` and deletes this file.
 */
export * from "@/lib/admin/nav"

/**
 * Registry hrefs whose pages have not moved yet (B2/B3 move them and drop
 * their entries; old URLs then redirect). Until then the shell links to the
 * page's current address so nothing it renders is a 404.
 */
export const CURRENT_ROUTES: Readonly<Record<string, string>> = {
  "/admin/marketing": "/admin/marketing/tracking",
  "/admin/marketing/code": "/admin/marketing/custom-code",
  "/admin/settings/ai-assistant": "/admin/settings/integrations/ai",
  "/admin/activity": "/admin/audit",
}
/** Registered pages that do not exist yet (B4 builds /admin/help). */
const UNBUILT = new Set([HELP_LINK.href])

const route = (href: string) => CURRENT_ROUTES[href] ?? href
const onCurrentRoute = <T extends NavLink>(link: T): T => ({
  ...link,
  href: route(link.href),
})

/** The item at current routes; a section opens its first visible sub-page. */
function legacyItem(item: NavItem): NavItem {
  if (!item.children) return onCurrentRoute(item)
  const children = item.children.map(onCurrentRoute)
  return { ...item, href: children[0]!.href, children }
}

const ACCOUNT = EXTRA_LINKS.find((link) => link.id === "account")!
const ACCOUNT_ITEM: NavItem = {
  ...ACCOUNT,
  group: "general",
  icon: ACCOUNT.icon!,
  match: "prefix",
  dock: true,
}

export type NavSection = { label: string; items: NavItem[] }

export type NavDestination = {
  label: string
  href: string
  icon: LucideIcon
  /** The section a sub-page belongs to (⌘K shows it as context). */
  parent: string | null
}

/** The sidebar menu (Menu / Growth / General) at current routes. */
export function menuSections(roles: readonly Role[]): NavSection[] {
  return visibleNav(roles).map((group) => ({
    label: group.label,
    items: group.items.map(legacyItem),
  }))
}

/**
 * Footer dock: Users & roles, Activity log (owners/admins) and Account; Help
 * replaces Account in B4, when /admin/help exists.
 */
export function dockItems(roles: readonly Role[]): NavItem[] {
  return [
    ...NAV_ITEMS.filter(
      (item) =>
        item.dock &&
        (item.permission === null || hasPermission(roles, item.permission))
    ).map(legacyItem),
    ACCOUNT_ITEM,
  ]
}

/** Every visible item, dock included, at current routes (section tab layouts). */
export function navItems(roles: readonly Role[]): NavSection[] {
  return [...menuSections(roles), { label: "Dock", items: dockItems(roles) }]
}

/** The visible item with this registry id, at current routes. */
export function findNavItem(
  roles: readonly Role[],
  id: string
): NavItem | undefined {
  return navItems(roles)
    .flatMap((section) => section.items)
    .find((item) => item.id === id)
}

/** ⌘K destinations: `reachableLinks` at current routes, unbuilt pages left out. */
export function navDestinations(roles: readonly Role[]): NavDestination[] {
  return reachableLinks(roles)
    .filter((link) => !UNBUILT.has(link.href))
    .map((link) => ({
      label: link.label,
      href: route(link.href),
      icon: link.icon,
      parent: link.parent,
    }))
}

const covers = (href: string, pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/** True when `pathname` is this item's page, below it, or one of its sub-pages. */
export function isActiveItem(item: NavItem, pathname: string): boolean {
  if (item.match === "exact") return pathname === item.href
  if (covers(item.href, pathname)) return true
  return (item.children ?? []).some((child) => covers(child.href, pathname))
}
