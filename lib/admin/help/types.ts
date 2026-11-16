import type { PermissionRequest } from "@/lib/auth/permissions"

/**
 * The admin's own help docs (/admin/help). Plain data, no React, so the
 * pages and the tests read the same registry.
 *
 * Inline text uses a tiny markup, rendered by components/admin/help/inline.tsx:
 *   **Exact UI label**              bold
 *   `⌘K`                            a keyboard hint
 *   [Open Media](/admin/media)      a link (an admin screen or /admin/help/<slug>)
 */
export type HelpGroupId =
  | "start"
  | "website"
  | "content"
  | "inbox"
  | "growth"
  | "settings"
  | "team"
  | "faq"

export type HelpBlock =
  | { type: "p"; text: string }
  | { type: "steps"; items: readonly string[] }
  | { type: "list"; items: readonly string[] }
  | { type: "callout"; tone: "tip" | "note" | "warning"; text: string }
  /** A button-style link to the admin screen the article is about. */
  | { type: "open"; href: string; label: string }

export type HelpSection = {
  title: string
  /** 3: a sub-heading (h3) under the section before it. Default 2 (h2). */
  level?: 2 | 3
  blocks: readonly HelpBlock[]
}

export type HelpArticle = {
  slug: string
  title: string
  group: HelpGroupId
  /** One line for cards and the sidebar. */
  description: string
  /** The paragraph under the title. */
  lead: string
  /**
   * Who can open the screens this article is about (any one of them is
   * enough). Omitted: every signed-in user.
   */
  permission?: PermissionRequest | readonly PermissionRequest[]
  keywords?: readonly string[]
  sections: readonly HelpSection[]
}
