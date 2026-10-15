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
} as const

/**
 * Expires tags now, so the next request (an admin checking their publish)
 * gets fresh data. Callable from Route Handlers (the Hono API) and Server
 * Actions only — never during render or from a timer (notes §2).
 */
export function invalidate(...tags: string[]): void {
  for (const t of tags) revalidateTag(t, { expire: 0 })
}
