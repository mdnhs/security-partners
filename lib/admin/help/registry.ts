import { permissionFor } from "@/lib/admin/nav"
import { hasPermission } from "@/lib/auth/permissions"

import { CONTENT_DOCS } from "./docs/content"
import { FAQ_DOCS } from "./docs/faq"
import { GROWTH_DOCS } from "./docs/growth"
import { INBOX_DOCS } from "./docs/inbox"
import { SETTINGS_DOCS } from "./docs/settings"
import { START_DOCS } from "./docs/start"
import { TEAM_DOCS } from "./docs/team"
import { WEBSITE_DOCS } from "./docs/website"
import type { HelpArticle, HelpBlock, HelpGroupId } from "./types"

export type { HelpArticle, HelpBlock, HelpGroupId } from "./types"

export const HELP_HREF = "/admin/help"

export const HELP_GROUPS: readonly {
  id: HelpGroupId
  label: string
  description: string
}[] = [
  {
    id: "start",
    label: "Getting started",
    description: "Signing in, finding your way, roles and how saving works.",
  },
  {
    id: "website",
    label: "Website",
    description: "The page screens, page sections, header, footer and pages.",
  },
  {
    id: "content",
    label: "Content & media",
    description: "Services, articles, jobs, team, client logos and images.",
  },
  {
    id: "inbox",
    label: "Enquiries & chat",
    description: "Answer enquiries, live chats and job applications.",
  },
  {
    id: "growth",
    label: "SEO & marketing",
    description: "Search engines, redirects, canonical URLs and tracking.",
  },
  {
    id: "settings",
    label: "Site settings",
    description: "Identity, notifications, colours, AI and integrations.",
  },
  {
    id: "team",
    label: "Team & account",
    description: "Invite people, check the activity log, your own account.",
  },
  {
    id: "faq",
    label: "Troubleshooting",
    description: "Quick answers when something looks wrong.",
  },
]

/** Sidebar order: group by group, articles in the order each file lists them. */
export const HELP_ARTICLES: readonly HelpArticle[] = HELP_GROUPS.flatMap(
  (group) =>
    [
      ...START_DOCS,
      ...WEBSITE_DOCS,
      ...CONTENT_DOCS,
      ...INBOX_DOCS,
      ...GROWTH_DOCS,
      ...SETTINGS_DOCS,
      ...TEAM_DOCS,
      ...FAQ_DOCS,
    ].filter((article) => article.group === group.id)
)

/** ⌘ on a Mac, Ctrl elsewhere: both are listed (the page renders on the server). */
export const HELP_SHORTCUTS: readonly {
  keys: readonly (readonly string[])[]
  action: string
}[] = [
  {
    keys: [
      ["⌘", "K"],
      ["Ctrl", "K"],
    ],
    action: "Search and go",
  },
  {
    keys: [
      ["⌘", "J"],
      ["Ctrl", "J"],
    ],
    action: "AI assistant",
  },
  {
    keys: [
      ["⌘", "S"],
      ["Ctrl", "S"],
    ],
    action: "Save draft",
  },
  { keys: [["Esc"]], action: "Close panels" },
]

/**
 * Sections of docs/runbook.md (not served by the site, so titles only);
 * tests/unit/admin/help-guides.test.ts pins each to a `## ` heading there.
 */
export const HELP_GUIDES: readonly string[] = [
  "Owner locked out",
  "Sessions and sign-in",
  "Backups and the restore drill",
  "Restore a backup",
  "Custom code and Content-Security-Policy",
  "Background jobs",
]

export const helpHref = (slug: string) => `${HELP_HREF}/${slug}`

export function helpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.slug === slug)
}

export function canReadArticle(
  roles: readonly string[],
  article: HelpArticle
): boolean {
  const { permission } = article
  if (!permission) return true
  const any = Array.isArray(permission) ? permission : [permission]
  return any.some((req) => hasPermission(roles, req))
}

/** Articles about screens the viewer cannot open are left out entirely. */
export function visibleArticles(roles: readonly string[]): HelpArticle[] {
  return HELP_ARTICLES.filter((article) => canReadArticle(roles, article))
}

export function groupedArticles(roles: readonly string[]) {
  const visible = visibleArticles(roles)
  return HELP_GROUPS.map((group) => ({
    ...group,
    articles: visible.filter((article) => article.group === group.id),
  })).filter((group) => group.articles.length > 0)
}

/** The previous and next article in sidebar order, among those visible. */
export function neighbours(roles: readonly string[], slug: string) {
  const visible = visibleArticles(roles)
  const at = visible.findIndex((article) => article.slug === slug)
  if (at === -1) return { prev: undefined, next: undefined }
  return { prev: visible[at - 1], next: visible[at + 1] }
}

/** "Saving vs publishing" -> "saving-vs-publishing": a section's anchor. */
export const headingId = (title: string) =>
  title
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

export type TocEntry = { id: string; title: string; level: 2 | 3 }

/** "On this page": one entry per section heading, in order, h3s indented. */
export function tocFor(article: HelpArticle): TocEntry[] {
  return article.sections.map((section) => ({
    id: headingId(section.title),
    title: section.title,
    level: section.level ?? 2,
  }))
}

/** Every string a block holds, for the link checks. */
function blockTexts(block: HelpBlock): string[] {
  switch (block.type) {
    case "p":
    case "callout":
      return [block.text]
    case "steps":
    case "list":
      return [...block.items]
    case "open":
      return [`[${block.label}](${block.href})`]
  }
}

export function articleTexts(article: HelpArticle): string[] {
  return [
    article.lead,
    ...article.sections.flatMap((section) => [
      section.title,
      ...section.blocks.flatMap(blockTexts),
    ]),
  ]
}

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g

/** Every href an article links to, in-text links and "open" buttons alike. */
export function articleLinks(article: HelpArticle): string[] {
  return articleTexts(article).flatMap((text) =>
    [...text.matchAll(LINK)].map((match) => match[2]!)
  )
}

/** "/admin/x?tab=y#z" -> "/admin/x". */
export const linkPath = (href: string) => href.split(/[?#]/)[0]!

/**
 * Whether the viewer may follow a link: another help article they can read,
 * or an admin screen their role opens (the nav registry's permission, the
 * same one the page guards check). Anything else renders as plain text.
 */
export function canFollow(roles: readonly string[], href: string): boolean {
  const path = linkPath(href)
  if (path === HELP_HREF) return true
  if (path.startsWith(`${HELP_HREF}/`)) {
    const article = helpArticle(path.slice(HELP_HREF.length + 1))
    return article ? canReadArticle(roles, article) : false
  }
  const permission = permissionFor(path)
  if (permission === undefined) return false
  return permission === null || hasPermission(roles, permission)
}

/** Lower-case, accents dropped, spaces squeezed: for the topics filter. */
export const normaliseSearch = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
