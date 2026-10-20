import { isSafeHref } from "@/lib/href"

// Redirect rules shared by the admin form, the API and proxy.ts.

/** Longest allowed chain from a redirect to its final address. */
export const MAX_REDIRECT_HOPS = 5

/** 301/308 permanent, 302/307 temporary; 307/308 keep the request method. */
export const REDIRECT_CODES = [301, 302, 307, 308] as const
export type RedirectCode = (typeof REDIRECT_CODES)[number]

/** A stored code as RedirectCode (the column check allows only these). */
export const redirectCode = (code: number): RedirectCode =>
  (REDIRECT_CODES as readonly number[]).includes(code)
    ? (code as RedirectCode)
    : 301

/**
 * Who made a redirect: manual (admin form), auto (rename/delete of a live
 * page), import (CSV). Server-owned. The single list: the column type and
 * the API type come from here; the DB check `redirects_source` repeats it
 * in SQL (pinned by tests/integration/api/redirects-admin.test.ts).
 */
export const REDIRECT_SOURCES = ["manual", "auto", "import"] as const
export type RedirectSource = (typeof REDIRECT_SOURCES)[number]

/**
 * A note may hold TAB and line breaks, never other control characters
 * (Postgres text refuses NUL; a spreadsheet file can carry any of them).
 */
export function noteProblem(note: string): string | null {
  for (let i = 0; i < note.length; i++) {
    const c = note.charCodeAt(i)
    if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f)
      return "Remove the control characters from the note"
  }
  return null
}

const RESERVED = [
  "/admin",
  "/api",
  "/_next",
  "/og",
  "/images",
  // Newsletter state pages (the API redirects there; never a redirect source).
  "/newsletter",
]
const PATH = /^\/[A-Za-z0-9\-._~%/]*$/
/** A path ending in a file extension (static files; never a page or redirect source). */
export const FILE_EXTENSION = /\.[A-Za-z0-9]+$/
/**
 * Percent-escapes a source may not use: / \ and control characters (they
 * change the path's shape once decoded) and every unreserved character
 * (A-Z a-z 0-9 - . _ ~), so "/%61dmin" or "/%61bout" cannot alias a reserved
 * prefix, a static page or a slug. Other escapes (spaces, non-ASCII) stay.
 */
const FORBIDDEN_ESCAPE =
  /%(2f|5c|[01][0-9a-f]|7f|2d|2e|3[0-9]|4[1-9a-f]|5[0-9a]|5f|6[1-9a-f]|7[0-9a]|7e)/i

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
  if (!decodes(path) || FORBIDDEN_ESCAPE.test(path))
    return "Type letters, numbers, / and - . _ ~ as themselves, not as %-escapes"
  const lower = path.toLowerCase()
  // Builder pages live at /p/<slug>; "/p" itself is no page of its own.
  if (lower === "/p") return "This address belongs to the site itself"
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

/**
 * The site path a target leads to: query and hash ignored, trailing slash
 * dropped (Next redirects "/x/" to "/x"), and an absolute URL on the site's
 * own origin (settings.site.productionUrl) read as its path. null for
 * external URLs.
 */
export function redirectTargetPath(
  to: string,
  siteOrigin: string | null = null
): string | null {
  let path: string | null = null
  if (to.startsWith("/")) path = to.split(/[?#]/)[0] ?? to
  else if (siteOrigin) {
    try {
      const url = new URL(to)
      if (url.origin === siteOrigin) path = url.pathname
    } catch {
      path = null
    }
  }
  if (path === null) return null
  return path.length > 1 ? path.replace(/\/+$/, "") || "/" : path
}

export type ChainCheck =
  { ok: true } | { ok: false; reason: "loop" | "too-long"; chain: string[] }

/**
 * Longest run of existing redirects that ends at `path` (reverse edges),
 * as the paths before it, farthest first. Stops once past the hop cap.
 */
function longestIncoming(
  edges: ReadonlyMap<string, string>,
  path: string,
  siteOrigin: string | null
): string[] {
  const into = new Map<string, string[]>()
  for (const [source, target] of edges) {
    const at = redirectTargetPath(target, siteOrigin)
    if (at === null) continue
    const list = into.get(at)
    if (list) list.push(source)
    else into.set(at, [source])
  }
  const walk = (at: string, seen: ReadonlySet<string>): string[] => {
    if (seen.size > MAX_REDIRECT_HOPS + 1) return []
    let best: string[] = []
    for (const source of into.get(at) ?? []) {
      if (seen.has(source)) continue
      const run = [...walk(source, new Set([...seen, source])), source]
      if (run.length > best.length) best = run
    }
    return best
  }
  return walk(path, new Set([path]))
}

/**
 * Checks the whole chain through the new redirect `from → to`: the longest
 * run of existing redirects into `from`, then `from → to` and onwards. A
 * path seen twice is a loop; more than MAX_REDIRECT_HOPS hops in total is
 * too long. `siteOrigin` makes absolute links to the site count as paths.
 */
export function checkRedirectChain(
  existing: ReadonlyMap<string, string>,
  from: string,
  to: string,
  siteOrigin: string | null = null
): ChainCheck {
  const edges = new Map(existing)
  edges.delete(from)
  const incoming = longestIncoming(edges, from, siteOrigin)
  edges.set(from, to)
  const chain = [from]
  let current = redirectTargetPath(to, siteOrigin)
  while (current !== null) {
    if (chain.includes(current))
      return { ok: false, reason: "loop", chain: [...chain, current] }
    chain.push(current)
    if (incoming.length + chain.length - 1 > MAX_REDIRECT_HOPS)
      return { ok: false, reason: "too-long", chain: [...incoming, ...chain] }
    const next = edges.get(current)
    current = next === undefined ? null : redirectTargetPath(next, siteOrigin)
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
