import "server-only"

import { revalidateTag } from "next/cache"

import type { SettingsKey } from "./settings-store"

/** Cache tags of the public queries (spec §5.6). */
export const tag = {
  page: (key: string) => `page:${key}`,
  services: "services",
  service: (slug: string) => `service:${slug}`,
  articles: "articles",
  article: (slug: string) => `article:${slug}`,
  categories: "categories",
  team: "team",
  clients: "clients",
  groupCompanies: "group-companies",
  settings: (key: SettingsKey) => `settings:${key}`,
  redirects: "redirects",
  media: (id: string) => `media:${id}`,
  /** Newsletter subscriber counts (admin dashboard only). */
  newsletter: "newsletter",
  builderPages: "builder-pages",
  builderPage: (slug: string) => `builder-page:${slug}`,
  /**
   * The admin dashboard's SEO health and content QA (D3.5): expired by
   * each SEO save and media change. Publishes and deletes reach those
   * readers through the public tags; draft saves expire nothing.
   */
  contentReview: "content-review",
} as const

/**
 * Expires tags now, so the next request (an admin checking their publish)
 * gets fresh data. Callable from Route Handlers (the Hono API) and Server
 * Actions only — never during render or from a timer (notes §2).
 */
export function invalidate(...tags: string[]): void {
  for (const t of tags) revalidateTag(t, { expire: 0 })
}
