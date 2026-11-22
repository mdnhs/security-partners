import { PAGE_LABELS } from "@/lib/admin/page-labels"
import {
  type EditableSettingsKey,
  SETTINGS_ENTRIES,
} from "@/lib/admin/settings-keys"
import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { CollectionName } from "@/lib/schemas/api/collections"
import type { PageKey } from "@/templates/registry"

/**
 * The Website menu: one admin screen per public page, plus custom pages,
 * legal pages and Header & footer. Each page screen shows its own page (the
 * "Page" tab) and the parts homed on it. Imported by the client sidebar, so
 * it imports values only from isomorphic modules (types only from templates
 * and the collections schema).
 */
export type WebsiteKey =
  | "home"
  | "about"
  | "services"
  | "team"
  | "blog"
  | "contact"
  | "careers"
  | "custom-pages"
  | "legal"
  | "header-footer"

/** The fixed pages edited under Legal pages, not on a screen of their own. */
export const LEGAL_PAGE_KEYS = [
  "privacy",
  "terms",
] as const satisfies readonly PageKey[]
export type LegalPageKey = (typeof LEGAL_PAGE_KEYS)[number]

export const isLegalPageKey = (value: string): value is LegalPageKey =>
  (LEGAL_PAGE_KEYS as readonly string[]).includes(value)

export type WebsiteScreen = {
  key: WebsiteKey
  label: string
  page: Exclude<PageKey, LegalPageKey> | null
  permission: PermissionRequest
  kind: "tabs" | "custom-pages" | "legal"
}

export type WebsitePartSource =
  | { kind: "settings"; key: EditableSettingsKey }
  | { kind: "collection"; name: CollectionName }
  | { kind: "route"; href: string }

export type WebsitePart = {
  id: string
  screen: WebsiteKey
  label: string
  source: WebsitePartSource
  permission: PermissionRequest
  /** false: owns its route (nav, guards, rail highlight) but is not a tab. */
  tab?: false
}

export type WebsiteTab = { id: string; label: string; href: string }

const PAGE_READ: PermissionRequest = { page: ["read"] }
const COLLECTION_READ: PermissionRequest = { collection: ["read"] }

const pageScreen = (
  key: Exclude<PageKey, LegalPageKey>,
  permission: PermissionRequest = PAGE_READ
): WebsiteScreen => ({
  key,
  label: PAGE_LABELS[key],
  page: key,
  permission,
  kind: "tabs",
})

/** Rail order. Page screens follow PAGE_KEYS (checked by the unit test). */
export const WEBSITE_SCREENS: readonly WebsiteScreen[] = [
  pageScreen("home"),
  pageScreen("about"),
  pageScreen("services"),
  pageScreen("team"),
  // Authors hold article:read but not page:read.
  pageScreen("blog", { article: ["read"] }),
  pageScreen("contact"),
  pageScreen("careers"),
  {
    key: "custom-pages",
    label: "Custom pages",
    page: null,
    permission: PAGE_READ,
    kind: "custom-pages",
  },
  {
    key: "legal",
    label: "Legal pages",
    page: null,
    permission: PAGE_READ,
    kind: "legal",
  },
  {
    key: "header-footer",
    label: "Header & footer",
    page: null,
    permission: { settings: ["read"] },
    kind: "tabs",
  },
]

const settingsPart = (
  id: string,
  screen: WebsiteKey,
  key: EditableSettingsKey,
  label = SETTINGS_ENTRIES[key].label
): WebsitePart => ({
  id,
  screen,
  label,
  source: { kind: "settings", key },
  permission: SETTINGS_ENTRIES[key].read,
})

const collectionPart = (
  id: string,
  screen: WebsiteKey,
  label: string,
  name: CollectionName
): WebsitePart => ({
  id,
  screen,
  label,
  source: { kind: "collection", name },
  permission: COLLECTION_READ,
})

const routePart = (
  id: string,
  screen: WebsiteKey,
  label: string,
  href: string,
  permission: PermissionRequest
): WebsitePart => ({
  id,
  screen,
  label,
  source: { kind: "route", href },
  permission,
})

/**
 * Tab order within each screen. A shared section lives on the page named
 * for it (About section, Contact section), else on the first page that
 * shows it (Home for the enquire banner and the clients strip).
 */
export const WEBSITE_PARTS: readonly WebsitePart[] = [
  settingsPart("enquire-banner", "home", "sections.enquireBanner"),
  settingsPart("clients-section", "home", "sections.clients"),
  collectionPart("clients", "home", "Client logos", "clients"),
  settingsPart("about-section", "about", "sections.about"),
  {
    ...routePart(
      "all-services",
      "services",
      "All services",
      "/admin/services",
      {
        service: ["read"],
      }
    ),
    tab: false,
  },
  settingsPart("why-choose-us", "services", "sections.whyChooseUs"),
  collectionPart("team", "team", "Team members", "team"),
  routePart("articles", "blog", "Articles", "/admin/insights", {
    article: ["read"],
  }),
  routePart(
    "categories",
    "blog",
    "Categories",
    "/admin/insights/categories",
    COLLECTION_READ
  ),
  settingsPart("contact-details", "contact", "contact"),
  settingsPart("contact-section", "contact", "sections.contact"),
  routePart("jobs", "careers", "Jobs", "/admin/careers", { job: ["read"] }),
  settingsPart("navigation", "header-footer", "navigation", "Header menu"),
  settingsPart("footer", "header-footer", "footer"),
  settingsPart("microcopy", "header-footer", "microcopy"),
  collectionPart(
    "group-companies",
    "header-footer",
    "Group companies",
    "group-companies"
  ),
]

/**
 * Settings sections edited inside a page's own form (one draft, one preview,
 * one Publish): `key` is the form group, `after` the group it follows on the
 * public page (templates/<page>/render), null = first. The sections keep
 * their stored records (shared across pages); the page editor loads, saves
 * and publishes them together with the page (components/admin/pages/page-bundle).
 */
export type PageSection = {
  key: string
  settings: EditableSettingsKey
  after: string | null
}

export const PAGE_SECTIONS: Partial<Record<PageKey, readonly PageSection[]>> = {
  home: [
    {
      key: "enquireBanner",
      settings: "sections.enquireBanner",
      after: "services",
    },
    { key: "clients", settings: "sections.clients", after: "enquireBanner" },
  ],
  about: [{ key: "about", settings: "sections.about", after: "hero" }],
  services: [
    {
      key: "whyChooseUs",
      settings: "sections.whyChooseUs",
      after: "servicesSection",
    },
  ],
  contact: [
    { key: "contactDetails", settings: "contact", after: "hero" },
    {
      key: "contactSection",
      settings: "sections.contact",
      after: "contactDetails",
    },
  ],
}

/**
 * Lists and links (not settings) that sit among a page's sections: they
 * open in place, as cards right after the section card of that key.
 */
export const PART_ANCHORS: Partial<
  Record<PageKey, Record<string, readonly string[]>>
> = {
  home: { clients: ["clients"] },
  team: { leadership: ["team"] },
  blog: { hero: ["articles", "categories"] },
  careers: { openings: ["jobs"] },
}

/**
 * A settings or collection part shown inside its page's form (PAGE_SECTIONS,
 * PART_ANCHORS) is not a tab of its own. Route parts stay tabs: they keep
 * their own URLs (/admin/insights…).
 */
function inPageForm(part: WebsitePart): boolean {
  // Header & footer is one form (tabs inside it), with the group companies.
  if (part.screen === "header-footer") return part.source.kind !== "route"
  const page = websiteScreen(part.screen).page
  if (!page) return false
  if (part.source.kind === "settings") {
    const key = part.source.key
    return (PAGE_SECTIONS[page] ?? []).some((s) => s.settings === key)
  }
  if (part.source.kind === "collection")
    return Object.values(PART_ANCHORS[page] ?? {}).some((ids) =>
      ids.includes(part.id)
    )
  return false
}

/** Identity and operations: stay under Site settings, not Website. */
export const SITE_SETTINGS_KEYS = [
  "site",
  "leads",
  "careers",
  "chat",
] as const satisfies readonly EditableSettingsKey[]

export function isWebsiteKey(value: string): value is WebsiteKey {
  return WEBSITE_SCREENS.some((screen) => screen.key === value)
}

export const websiteHref = (key: WebsiteKey) => `/admin/website/${key}`

/** Where a fixed page is edited: its screen, or Legal pages for privacy/terms. */
export const pageEditorHref = (key: PageKey): string =>
  isLegalPageKey(key) ? `${websiteHref("legal")}/${key}` : websiteHref(key)

export const websiteScreen = (key: WebsiteKey): WebsiteScreen =>
  WEBSITE_SCREENS.find((screen) => screen.key === key)!

export function websitePart(
  screen: WebsiteKey,
  id: string
): WebsitePart | undefined {
  return WEBSITE_PARTS.find((part) => part.screen === screen && part.id === id)
}

export function partHref(part: WebsitePart): string {
  if (part.source.kind === "route") return part.source.href
  // Parts of the Header & footer form are its tabs (?tab=<form group>); the
  // group companies sit on the Footer tab.
  if (part.screen === "header-footer")
    return `${websiteHref(part.screen)}?tab=${
      part.source.kind === "settings" ? part.source.key : "footer"
    }`
  return `${websiteHref(part.screen)}/${part.id}`
}

const toTab = (part: WebsitePart): WebsiteTab => ({
  id: part.id,
  label: part.label,
  href: partHref(part),
})

/** The screen's tabs these roles may read: "Page" first, then its parts. */
export function websiteTabs(
  screen: WebsiteKey,
  roles: readonly string[]
): WebsiteTab[] {
  const tabs: WebsiteTab[] = []
  const pageTab: WebsiteTab | null =
    websiteScreen(screen).page && hasPermission(roles, PAGE_READ)
      ? {
          id: "page",
          label: screen === CAREERS_JOBS_FIRST ? "Page text" : "Page",
          // Careers lands on Jobs: its page text sits behind ?view=text.
          href:
            screen === CAREERS_JOBS_FIRST
              ? `${websiteHref(screen)}?view=text`
              : websiteHref(screen),
        }
      : null
  if (pageTab && screen !== CAREERS_JOBS_FIRST) tabs.push(pageTab)
  for (const part of WEBSITE_PARTS)
    if (
      part.screen === screen &&
      part.tab !== false &&
      !inPageForm(part) &&
      hasPermission(roles, part.permission)
    )
      tabs.push(toTab(part))
  // Careers is about posting jobs: Jobs comes first, the page's own text last.
  if (pageTab && screen === CAREERS_JOBS_FIRST) tabs.push(pageTab)
  return tabs
}

/** The screen whose Jobs list leads and whose page text comes after it. */
const CAREERS_JOBS_FIRST: WebsiteKey = "careers"

const settingsPartOf = (key: string) =>
  WEBSITE_PARTS.find(
    (part) => part.source.kind === "settings" && part.source.key === key
  )

export function isWebsiteSettingsKey(key: string): boolean {
  return settingsPartOf(key) !== undefined
}

/** Where a settings key is edited: its Website part, else Site settings. */
export function adminHrefForSettings(key: EditableSettingsKey): string {
  const part = settingsPartOf(key)
  return part ? partHref(part) : `/admin/settings/${key}`
}

/** Where a collection is edited (categories live under Blog). */
export function adminHrefForCollection(name: CollectionName): string {
  const part = WEBSITE_PARTS.find(
    (p) =>
      (p.source.kind === "collection" && p.source.name === name) ||
      (name === "categories" && p.id === "categories")
  )
  // Every collection has a part (pinned by the unit test); the Website
  // index is the fallback, never the old /admin/collections stub.
  return part ? partHref(part) : "/admin/website"
}

/** Appends the query (repeated keys for arrays, undefined dropped). */
export function withSearch(
  href: string,
  search: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams()
  for (const [name, value] of Object.entries(search)) {
    if (value === undefined) continue
    for (const item of Array.isArray(value) ? value : [value])
      params.append(name, item)
  }
  const query = params.toString()
  if (!query) return href
  return `${href}${href.includes("?") ? "&" : "?"}${query}`
}
