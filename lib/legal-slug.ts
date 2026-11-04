// Legal page addresses (/<slug>) without zod, so proxy.ts can check a slug
// without loading the schemas. lib/schemas/api/legal-pages `legalSlug` is
// built from these.

export const LEGAL_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const LEGAL_SLUG_MAX = 60

/**
 * Root addresses a legal page may never take: the site's own routes, files
 * and areas. tests/unit/legal-slug.test.ts checks this list against the app
 * directory, so a new top-level route cannot be shadowed unnoticed.
 */
export const RESERVED_LEGAL_SLUGS = [
  "about",
  "admin",
  "api",
  "blog",
  "careers",
  "contact",
  "favicon",
  "images",
  "og",
  "p",
  "privacy",
  "robots",
  "services",
  "sitemap",
  "team",
  "terms",
] as const

const RESERVED = new Set<string>(RESERVED_LEGAL_SLUGS)

export const isReservedLegalSlug = (slug: string) => RESERVED.has(slug)

/** A well-formed, unreserved legal slug (what `legalSlug` accepts). */
export function isLegalSlug(slug: string): boolean {
  return (
    slug.length <= LEGAL_SLUG_MAX &&
    LEGAL_SLUG_PATTERN.test(slug) &&
    !RESERVED.has(slug)
  )
}
