import type { ConsentChoice } from "@/lib/analytics/consent"
import type {
  CustomCodeSettings,
  Snippet,
} from "@/lib/schemas/settings/custom-code"

/**
 * Window event ConsentProvider dispatches whenever `window.__spConsent`
 * is set (the stored choice on load, then each new choice). The custom
 * code loader (components/consent/custom-code.tsx) listens for it.
 */
export const CONSENT_EVENT = "sp:consent"

const trimSlash = (path: string) =>
  path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path

/**
 * "/" matches only the home page; "/x/*" matches "/x" and everything under
 * it (never "/xy"); any other pattern matches that path exactly. A trailing
 * slash is ignored on both sides.
 */
export function routeMatches(pattern: string, pathname: string): boolean {
  const path = trimSlash(pathname)
  if (pattern.endsWith("/*")) {
    const base = trimSlash(pattern.slice(0, -2) || "/")
    if (base === "/") return true
    return path === base || path.startsWith(`${base}/`)
  }
  return trimSlash(pattern) === path
}

/** The snippets to load on `pathname` in `placement` ([] when switched off). */
export function runnableSnippets(
  cfg: CustomCodeSettings,
  pathname: string,
  placement: "head" | "body"
): Snippet[] {
  if (cfg.disabled) return []
  return cfg.snippets.filter(
    (s) =>
      s.enabled &&
      s.placement === placement &&
      (s.routes.length === 0 ||
        s.routes.some((pattern) => routeMatches(pattern, pathname)))
  )
}

/** Necessary snippets always run; the others need consent to their category. */
export function snippetAllowed(
  s: Snippet,
  consent: ConsentChoice | null
): boolean {
  if (s.category === "necessary") return true
  return consent?.[s.category] === true
}

const hasCode = (html: string) => /\S/.test(html)

/** UUID v4 in browsers outside a secure context too (no crypto.randomUUID). */
export function newSnippetId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6]! & 0x0f) | 0x40
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * The pre-D2.3 value ({ headHtml, bodyEndHtml }) as snippets: each non-blank
 * block becomes a necessary, all-routes snippet (it ran without consent
 * before, so it keeps doing so). Mirrors the SQL in 0015_marketing.
 */
export function convertLegacyCustomCode(old: {
  headHtml: string
  bodyEndHtml: string
}): CustomCodeSettings {
  const legacy = (
    name: string,
    placement: "head" | "body",
    html: string
  ): Snippet[] =>
    hasCode(html)
      ? [
          {
            id: newSnippetId(),
            name,
            placement,
            src: "",
            html,
            category: "necessary",
            routes: [],
            enabled: true,
          },
        ]
      : []
  return {
    disabled: false,
    allowedHosts: [],
    snippets: [
      ...legacy("Head code", "head", old.headHtml),
      ...legacy("Body code", "body", old.bodyEndHtml),
    ],
  }
}
