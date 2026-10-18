import { z } from "zod"

/** GET /api/v1/admin/search?q= (⌘K palette). */
export const searchQuery = z.object({
  q: z.string().trim().min(1, "Type something to search").max(100),
})

export const SEARCH_TYPES = [
  "page",
  "service",
  "article",
  "team",
  "client",
  "groupCompany",
  "category",
] as const
export type SearchType = (typeof SEARCH_TYPES)[number]

export type SearchResult = {
  type: SearchType
  id: string
  title: string
  subtitle: string | null
  /** Admin URL that edits the record. */
  href: string
}

/** Per-type cap so one busy type cannot crowd out the others. */
export const SEARCH_LIMIT_PER_TYPE = 5

/** Option sources for SchemaForm's collection and link widgets. */
export const OPTION_COLLECTIONS = [
  "articles",
  "services",
  "categories",
  "pages",
  "links",
] as const
export type OptionCollection = (typeof OPTION_COLLECTIONS)[number]
export const optionsParam = z.object({ collection: z.enum(OPTION_COLLECTIONS) })

export type OptionItem = {
  /** Stored value: slug (articles/services), id (categories), URL path (pages/links). */
  value: string
  label: string
  group: string
}
