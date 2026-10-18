// Absolute URLs of the public site (canonical, sitemap, JSON-LD, share
// images). Isomorphic: no server imports.

/** Origin of an absolute http(s) URL, or null. */
export function originOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null
  } catch {
    return null
  }
}

/**
 * The origin search engines should see: settings.site.productionUrl when
 * set (staging copies still point canonical URLs at production), else the
 * deployment's own origin (BETTER_AUTH_URL).
 */
export function siteOrigin(
  productionUrl: string | null | undefined,
  fallback: string
): string {
  const origin = originOf(productionUrl) ?? originOf(fallback)
  if (!origin)
    throw new Error(
      "No site origin: set settings.site.productionUrl or BETTER_AUTH_URL"
    )
  return origin
}

export function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString()
}

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const

export const OG_KINDS = ["page", "service", "article"] as const
export type OgKind = (typeof OG_KINDS)[number]

export function isOgKind(value: string): value is OgKind {
  return (OG_KINDS as readonly string[]).includes(value)
}

/** The generated share card of a page (key), service or article (slug). */
export const ogImagePath = (kind: OgKind, id: string) =>
  `/og/${kind}/${encodeURIComponent(id)}`
