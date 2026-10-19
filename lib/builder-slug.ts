// Builder page addresses (/p/<slug>) without zod, so proxy.ts can check a
// slug without loading the block schemas (D5.3 review minor 3).
// lib/schemas/api/builder-pages `builderSlug` is built from these.

export const BUILDER_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const BUILDER_SLUG_MAX = 60

/**
 * Slugs under /p/ that are refused although they fit the format: they read
 * as the site's own areas (Review Focus 1, "/p/admin").
 */
export const RESERVED_BUILDER_SLUGS = [
  "admin",
  "api",
  "og",
  "images",
  "p",
] as const

const RESERVED = new Set<string>(RESERVED_BUILDER_SLUGS)

export const isReservedBuilderSlug = (slug: string) => RESERVED.has(slug)

/** A well-formed, unreserved builder slug (what `builderSlug` accepts). */
export function isBuilderSlug(slug: string): boolean {
  return (
    slug.length <= BUILDER_SLUG_MAX &&
    BUILDER_SLUG_PATTERN.test(slug) &&
    !RESERVED.has(slug)
  )
}
