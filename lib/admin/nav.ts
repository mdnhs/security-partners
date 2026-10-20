import {
  Building2,
  CircleHelp,
  Component,
  FileText,
  Images,
  Inbox,
  LayoutDashboard,
  Layers,
  type LucideIcon,
  Megaphone,
  Newspaper,
  Palette,
  ScrollText,
  SearchCheck,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
  UserRound,
  Users,
  Wrench,
} from "lucide-react"

import { GROWTH_SETTINGS } from "@/lib/admin/growth-settings"
import {
  EDITABLE_SETTINGS_KEYS,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { Role } from "@/lib/auth/roles"

/**
 * The admin IA (MK parity spec §5.1) as one isomorphic registry: the sidebar,
 * the section rails, ⌘K and every panel page's guard (`permissionFor`) read
 * it, so a link is listed exactly when its page opens.
 */
export type NavGroupId = "menu" | "growth" | "general"

/** Live counts shown beside nav items. */
export type NavBadgeKey = "new-leads"
export type NavBadges = Partial<Record<NavBadgeKey, number>>

export type NavLink = {
  id: string
  label: string
  href: string
  /** null = every signed-in user. */
  permission: PermissionRequest | null
  /** Extra ⌘K search terms. */
  keywords?: readonly string[]
  /** ⌘K's icon for this link (a child falls back to its section's). */
  icon?: LucideIcon
}

/**
 * A count beside the label: which one, and what the count is of for screen
 * readers ("3 new enquiries"), kept apart from the label so renaming the
 * item never changes what assistive tech announces.
 */
type NavItemBadge =
  | { badge?: undefined; badgeLabel?: undefined }
  | { badge: NavBadgeKey; badgeLabel: string }

export type NavItem = NavLink &
  NavItemBadge & {
    group: NavGroupId
    icon: LucideIcon
    /** "exact" only for /admin (otherwise every admin URL would match). */
    match: "exact" | "prefix"
    /** Sub-pages, shown as the section rail inside the content panel. */
    children?: NavLink[]
    /** Drawn as an icon button in the sidebar's footer dock, not in the menu. */
    dock?: true
  }

export type ReachableLink = NavLink & {
  /** The section's label for a sub-page (⌘K context); null for a section. */
  parent: string | null
  /** The section's own search terms for a sub-page; empty for a section. */
  parentKeywords: readonly string[]
  icon: LucideIcon
}

export const NAV_GROUPS: readonly { id: NavGroupId; label: string }[] = [
  { id: "menu", label: "Menu" },
  { id: "growth", label: "Growth" },
  { id: "general", label: "General" },
]

const COLLECTION = { collection: ["read"] } satisfies PermissionRequest
const INTEGRATION = { integration: ["read"] } satisfies PermissionRequest

const collection = (
  slug: string,
  label: string,
  icon: LucideIcon
): NavLink => ({
  id: `collections-${slug}`,
  label,
  href: `/admin/collections/${slug}`,
  permission: COLLECTION,
  icon,
})

export const NAV_ITEMS: readonly NavItem[] = [
  {
    id: "dashboard",
    group: "menu",
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    permission: null,
    match: "exact",
    keywords: ["home", "overview"],
  },
  {
    id: "pages",
    group: "menu",
    label: "Pages",
    href: "/admin/pages",
    icon: FileText,
    permission: { page: ["read"] },
    match: "prefix",
    keywords: ["home page", "about", "contact"],
  },
  {
    id: "insights",
    group: "menu",
    label: "Insights",
    href: "/admin/insights",
    icon: Newspaper,
    permission: { article: ["read"] },
    match: "prefix",
    keywords: ["blog", "articles", "posts", "news"],
    children: [
      {
        id: "insights-articles",
        label: "Articles",
        href: "/admin/insights",
        permission: { article: ["read"] },
        icon: Newspaper,
      },
      {
        id: "insights-categories",
        label: "Categories",
        href: "/admin/insights/categories",
        permission: COLLECTION,
        icon: Tags,
        keywords: ["tags", "topics"],
      },
    ],
  },
  {
    id: "services",
    group: "menu",
    label: "Services",
    href: "/admin/services",
    icon: Wrench,
    permission: { service: ["read"] },
    match: "prefix",
    keywords: ["security services", "offerings"],
  },
  {
    id: "collections",
    group: "menu",
    label: "Collections",
    href: "/admin/collections",
    icon: Layers,
    permission: COLLECTION,
    match: "prefix",
    keywords: ["team", "clients", "group companies"],
    children: [
      collection("team", "Team", Users),
      collection("clients", "Clients", ShieldCheck),
      collection("group-companies", "Group companies", Building2),
    ],
  },
  {
    id: "media",
    group: "menu",
    label: "Media",
    href: "/admin/media",
    icon: Images,
    permission: { media: ["read"] },
    match: "prefix",
    keywords: ["images", "uploads", "library"],
  },
  {
    id: "leads",
    group: "menu",
    label: "Enquiries",
    href: "/admin/leads",
    icon: Inbox,
    permission: { lead: ["read"] },
    match: "prefix",
    badge: "new-leads",
    badgeLabel: "new enquiries",
    keywords: ["leads", "contact", "inbox", "messages"],
  },
  {
    id: "seo",
    group: "growth",
    label: "SEO",
    href: "/admin/seo",
    icon: SearchCheck,
    permission: { seo: ["read"] },
    match: "prefix",
    keywords: ["search", "google", "meta", "sitemap"],
    children: [
      {
        id: "seo-overview",
        label: "Overview",
        href: "/admin/seo",
        permission: { seo: ["read"] },
      },
      {
        id: "seo-defaults",
        label: "Defaults",
        href: "/admin/seo/defaults",
        permission: GROWTH_SETTINGS["seo.defaults"].read,
        keywords: ["title pattern", "share image"],
      },
      {
        id: "seo-redirects",
        label: "Redirects",
        href: "/admin/seo/redirects",
        permission: { redirect: ["read"] },
        keywords: ["301", "404"],
      },
    ],
  },
  {
    id: "marketing",
    group: "growth",
    label: "Marketing",
    href: "/admin/marketing",
    icon: Megaphone,
    permission: { marketing: ["read"] },
    match: "prefix",
    keywords: ["analytics", "gtm", "ga4", "pixel", "tracking"],
    children: [
      {
        id: "marketing-tracking",
        label: "Tracking",
        href: "/admin/marketing",
        permission: GROWTH_SETTINGS.tracking.read,
        keywords: ["gtm", "ga4", "pixel"],
      },
      {
        id: "marketing-consent",
        label: "Consent banner",
        href: "/admin/marketing/consent",
        permission: GROWTH_SETTINGS.consent.read,
        keywords: ["cookies", "gdpr"],
      },
      {
        id: "marketing-events",
        label: "Event catalogue",
        href: "/admin/marketing/events",
        permission: { marketing: ["read"] },
        keywords: ["events", "datalayer", "conversions"],
      },
      {
        id: "marketing-code",
        label: "Custom code",
        href: "/admin/marketing/code",
        // Owner only; the same rule the page and API check.
        permission: GROWTH_SETTINGS.customCode.read,
        keywords: ["snippets", "scripts", "head"],
      },
    ],
  },
  {
    id: "appearance",
    group: "general",
    label: "Appearance",
    href: "/admin/appearance",
    icon: Palette,
    permission: { appearance: ["read"] },
    match: "prefix",
    keywords: ["theme", "colours", "colors", "brand", "logo"],
  },
  {
    id: "settings",
    group: "general",
    label: "Site settings",
    href: "/admin/settings",
    icon: Settings,
    permission: { settings: ["read"] },
    match: "prefix",
    keywords: ["identity", "contact", "footer", "navigation"],
    children: [
      ...EDITABLE_SETTINGS_KEYS.map((key): NavLink => ({
        id: `settings-${key}`,
        label: SETTINGS_ENTRIES[key].label,
        href: `/admin/settings/${key}`,
        permission: SETTINGS_ENTRIES[key].read,
      })),
      {
        id: "settings-ai-assistant",
        label: "AI assistant",
        href: "/admin/settings/ai-assistant",
        permission: INTEGRATION,
        keywords: ["ai", "assistant", "claude", "openai", "gemini", "chatbot"],
      },
      {
        id: "settings-integrations",
        label: "Integrations",
        href: "/admin/settings/integrations",
        permission: INTEGRATION,
        keywords: ["smtp", "email", "turnstile", "storage", "api keys"],
      },
    ],
  },
  {
    id: "users",
    group: "general",
    label: "Users & roles",
    href: "/admin/users",
    icon: UserCog,
    permission: { user: ["read"] },
    match: "prefix",
    dock: true,
    keywords: ["team", "invite", "people", "permissions"],
  },
  {
    id: "activity",
    group: "general",
    label: "Activity log",
    href: "/admin/activity",
    icon: ScrollText,
    permission: { audit: ["read"] },
    match: "prefix",
    dock: true,
    keywords: ["audit", "history", "changes"],
  },
]

/** In the footer dock beside Log out, for every signed-in user. */
export const HELP_LINK: NavLink = {
  id: "help",
  label: "Help",
  href: "/admin/help",
  permission: null,
  icon: CircleHelp,
  keywords: ["support", "guide", "how to", "shortcuts"],
}

/**
 * Not in the sidebar: Account is in the user menu and ⌘K; the design system
 * gallery is ⌘K only and owner-only (customCode:update is held by owners alone).
 */
export const EXTRA_LINKS: readonly NavLink[] = [
  {
    id: "account",
    label: "Account",
    href: "/admin/account",
    permission: null,
    icon: UserRound,
    keywords: ["profile", "password", "sessions", "security", "two-factor"],
  },
  {
    id: "design",
    label: "Design system",
    href: "/admin/design",
    permission: { customCode: ["update"] },
    icon: Component,
    keywords: ["components", "gallery", "kpi", "chart"],
  },
]

const allowed = (roles: readonly string[], link: NavLink) =>
  link.permission === null || hasPermission(roles, link.permission)

/** `pathname` is `href` or below it (on a `/` boundary). */
const covers = (href: string, pathname: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/**
 * The item as `roles` see it: children filtered by their own permission;
 * null when the item is hidden or every child is.
 */
function visibleItem(item: NavItem, roles: readonly string[]): NavItem | null {
  if (!allowed(roles, item)) return null
  if (!item.children) return item
  const children = item.children.filter((child) => allowed(roles, child))
  return children.length > 0 ? { ...item, children } : null
}

const visibleItems = (roles: readonly string[]) =>
  NAV_ITEMS.flatMap((item) => visibleItem(item, roles) ?? [])

/** The sidebar menu: groups in order, dock items left out, empty groups dropped. */
export function visibleNav(
  roles: readonly Role[]
): { group: NavGroupId; label: string; items: NavItem[] }[] {
  const items = visibleItems(roles).filter((item) => !item.dock)
  return NAV_GROUPS.map((group) => ({
    group: group.id,
    label: group.label,
    items: items.filter((item) => item.group === group.id),
  })).filter((group) => group.items.length > 0)
}

/**
 * Where a section index without a page of its own (/admin/settings,
 * /admin/collections) lands: its first child `roles` may open; undefined
 * when the section is hidden from them or has no children.
 */
export function firstVisibleChild(
  id: string,
  roles: readonly Role[]
): NavLink | undefined {
  const item = NAV_ITEMS.find((candidate) => candidate.id === id)
  return item ? visibleItem(item, roles)?.children?.[0] : undefined
}

/** The footer dock: Users & roles, Activity log (when allowed) and Help. */
export function dockLinks(roles: readonly Role[]): NavLink[] {
  return [
    ...visibleItems(roles).filter((item) => item.dock),
    ...(allowed(roles, HELP_LINK) ? [HELP_LINK] : []),
  ]
}

/**
 * Every page `roles` may open, once each, for ⌘K: a section with sub-pages
 * is listed as its sub-pages (labelled with the section), then Help and the
 * extra links.
 */
export function reachableLinks(roles: readonly Role[]): ReachableLink[] {
  const seen = new Set<string>()
  const out: ReachableLink[] = []
  const add = (link: NavLink, icon: LucideIcon, section?: NavItem) => {
    if (seen.has(link.href)) return
    seen.add(link.href)
    out.push({
      ...link,
      parent: section?.label ?? null,
      parentKeywords: section?.keywords ?? [],
      icon: link.icon ?? icon,
    })
  }
  for (const item of visibleItems(roles)) {
    if (item.children)
      for (const child of item.children) add(child, item.icon, item)
    else add(item, item.icon)
  }
  for (const link of [HELP_LINK, ...EXTRA_LINKS])
    if (allowed(roles, link)) add(link, link.icon ?? CircleHelp)
  return out
}

/** Every href an item (or its children) answers for, longest match wins. */
const matchLength = (item: NavItem, pathname: string): number => {
  if (item.match === "exact")
    return pathname === item.href ? item.href.length : -1
  return Math.max(
    -1,
    ...[item, ...(item.children ?? [])]
      .filter((link) => covers(link.href, pathname))
      .map((link) => link.href.length)
  )
}

/** The visible item whose page (or a sub-page of it) `pathname` is. */
export function activeItem(
  pathname: string,
  roles: readonly Role[]
): NavItem | null {
  let best: NavItem | null = null
  let bestLength = -1
  for (const item of visibleItems(roles)) {
    const length = matchLength(item, pathname)
    if (length > bestLength) {
      best = item
      bestLength = length
    }
  }
  return best
}

/** The child of `item` whose href is the longest prefix of `pathname`. */
export function activeChild(item: NavItem, pathname: string): NavLink | null {
  let best: NavLink | null = null
  for (const child of item.children ?? [])
    if (
      covers(child.href, pathname) &&
      child.href.length > (best?.href.length ?? -1)
    )
      best = child
  return best
}

/** Children before their item, so a shared href resolves to the child. */
const REGISTERED: readonly (NavLink & { match: "exact" | "prefix" })[] = [
  ...NAV_ITEMS.flatMap((item) => [
    ...(item.children ?? []).map((child) => ({
      ...child,
      match: "prefix" as const,
    })),
    item,
  ]),
  ...[HELP_LINK, ...EXTRA_LINKS].map((link) => ({
    ...link,
    match: "prefix" as const,
  })),
]

/**
 * The permission a panel page at `pathname` needs: the exact registered
 * href's, else the longest registered `/`-boundary prefix's (only /admin
 * itself is exact-only). `null` = any signed-in user; `undefined` = not
 * registered (the page guard turns that into a 404).
 */
export function permissionFor(
  pathname: string
): PermissionRequest | null | undefined {
  const exact = REGISTERED.find((link) => link.href === pathname)
  if (exact) return exact.permission
  let best: (typeof REGISTERED)[number] | undefined
  for (const link of REGISTERED)
    if (
      link.match === "prefix" &&
      covers(link.href, pathname) &&
      link.href.length > (best?.href.length ?? -1)
    )
      best = link
  return best ? best.permission : undefined
}
