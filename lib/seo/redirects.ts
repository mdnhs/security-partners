import { isSafeHref } from "@/lib/href"

// Redirect rules shared by the admin form, the API and proxy.ts.

/** Longest allowed chain from a redirect to its final address. */
export const MAX_REDIRECT_HOPS = 5

const RESERVED = ["/admin", "/api", "/_next", "/og", "/images"]
const PATH = /^\/[A-Za-z0-9\-._~%/]*$/
const FILE_EXTENSION = /\.[A-Za-z0-9]+$/
/** Percent-escapes that would change the path's shape once decoded: / \ . and control characters. */
const SHAPE_ESCAPE = /%(2f|5c|2e|[01][0-9a-f]|7f)/i

const decodes = (path: string) => {
  try {
    decodeURIComponent(path)
    return true
  } catch {
    return false
  }
}

/** Why `path` cannot be a redirect source, or null. Live pages are checked by the server. */
export function fromPathProblem(path: string): string | null {
  if (path.length > 300) return "Keep the address under 300 characters"
  if (!PATH.test(path))
    return "Use an address like /old-page (letters, numbers and - . _ ~ / only, no ? or #)"
  if (path === "/") return "The home page can't be redirected"
  if (path.includes("//")) return "Use single slashes"
  if (path.endsWith("/")) return "Leave off the trailing slash"
  // Browsers resolve "/a/../b" before asking, so such a source never matches.
  if (path.split("/").some((segment) => segment === "." || segment === ".."))
    return "Leave out . and .. segments"
  if (!decodes(path) || SHAPE_ESCAPE.test(path))
    return "Use plain characters instead of %-escapes for / \\ . and control characters"
  const lower = path.toLowerCase()
  if (
    lower.startsWith("/_") ||
    RESERVED.some(
      (prefix) => lower === prefix || lower.startsWith(`${prefix}/`)
    )
  )
    return "This address belongs to the site itself"
  if (FILE_EXTENSION.test(path))
    return "Addresses ending in a file extension (.html, .php …) can't be redirected"
  return null
}

/** Why `to` cannot be a redirect target, or null (the app's href guard, lib/href.ts). */
export function toPathProblem(to: string): string | null {
  if (to.length === 0) return "Required"
  if (to.length > 2000) return "Keep the address under 2000 characters"
  if (
    !isSafeHref(to) ||
    to.includes("{") ||
    !(to.startsWith("/") || /^https?:\/\//i.test(to))
  )
    return "Use a site address like /services or a full https:// link"
  return null
}

/** The site path a target leads to (query and hash ignored); null for external URLs. */
const targetPath = (to: string): string | null =>
  to.startsWith("/") ? (to.split(/[?#]/)[0] ?? to) : null

export type ChainCheck =
  { ok: true } | { ok: false; reason: "loop" | "too-long"; chain: string[] }

/**
 * Follows `from → to` through the existing redirects (from_path → to_path).
 * A path seen twice is a loop; more than MAX_REDIRECT_HOPS hops is too long.
 */
export function checkRedirectChain(
  existing: ReadonlyMap<string, string>,
  from: string,
  to: string
): ChainCheck {
  const edges = new Map(existing)
  edges.set(from, to)
  const chain = [from]
  let current = targetPath(to)
  while (current !== null) {
    if (chain.includes(current))
      return { ok: false, reason: "loop", chain: [...chain, current] }
    chain.push(current)
    if (chain.length - 1 > MAX_REDIRECT_HOPS)
      return { ok: false, reason: "too-long", chain }
    const next = edges.get(current)
    current = next === undefined ? null : targetPath(next)
  }
  return { ok: true }
}

/** Absolute Location for a matched redirect; a site path keeps the request's query unless it has its own. */
export function redirectLocation(to: string, requestUrl: URL): URL {
  if (!to.startsWith("/")) return new URL(to)
  const url = new URL(to, requestUrl.origin)
  if (!to.includes("?") && requestUrl.search) url.search = requestUrl.search
  return url
}
