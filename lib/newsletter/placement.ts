import type { NewsletterPlacement } from "@/lib/schemas/settings/newsletter"

/**
 * Where a NewsletterSection sits. Spelled out (not derived from
 * NewsletterPlacement) so a new placement value never widens the call sites.
 */
export type NewsletterWhere = "blog" | "article"

/** Ruling 2: the form renders only at the placement an admin chose ("off" renders nothing). */
export function shouldRender(
  placement: NewsletterPlacement,
  where: NewsletterWhere
): boolean {
  return placement !== "off" && placement === where
}

/**
 * /newsletter/[state]: the confirm view the mail links to, the pages the
 * public API redirects to, and the unsubscribe button page.
 */
export const NEWSLETTER_STATES = [
  "confirm",
  "confirmed",
  "invalid",
  "unsubscribe",
  "unsubscribed",
] as const
export type NewsletterState = (typeof NEWSLETTER_STATES)[number]

export function isNewsletterState(value: string): value is NewsletterState {
  return (NEWSLETTER_STATES as readonly string[]).includes(value)
}

/** The public API endpoints the button pages POST their token to (never a GET). */
export const NEWSLETTER_CONFIRM_ENDPOINT = "/api/v1/public/newsletter/confirm"
export const NEWSLETTER_UNSUBSCRIBE_ENDPOINT =
  "/api/v1/public/newsletter/unsubscribe"

const BUTTON_ACTIONS: Partial<Record<NewsletterState, string>> = {
  confirm: NEWSLETTER_CONFIRM_ENDPOINT,
  unsubscribe: NEWSLETTER_UNSUBSCRIBE_ENDPOINT,
}

/** Longest token a page will echo into its form (`<uuid>.<32 chars>` is 69). */
export const MAX_NEWSLETTER_TOKEN = 200

export type NewsletterView = {
  state: NewsletterState
  token: string
  /** The endpoint the page's button POSTs to; null for a display-only page. */
  action: string | null
}

/**
 * What a /newsletter/[state] request shows. A button page without a usable
 * token shows the "invalid" copy: posting "" would only land on a page that
 * claims success (unsubscribe) or fails anyway (confirm).
 */
export function newsletterView(
  state: NewsletterState,
  token: unknown
): NewsletterView {
  const action = BUTTON_ACTIONS[state] ?? null
  if (!action) return { state, token: "", action: null }
  if (
    typeof token !== "string" ||
    token === "" ||
    token.length > MAX_NEWSLETTER_TOKEN
  )
    return { state: "invalid", token: "", action: null }
  return { state, token, action }
}

/**
 * True on a /newsletter page whose URL carries a token: analytics tags
 * (whose page views report the full URL) never load there.
 */
export function carriesNewsletterToken(location: {
  pathname: string
  search: string
}): boolean {
  return (
    location.pathname.startsWith("/newsletter/") &&
    new URLSearchParams(location.search).has("token")
  )
}
