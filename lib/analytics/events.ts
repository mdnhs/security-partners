import type { ConsentChoice } from "./consent"

// Typed dataLayer event catalogue (spec §10).

export const ANALYTICS_EVENTS = [
  "lead_submitted",
  "cta_click",
  "phone_click",
  "email_click",
] as const

export type AnalyticsEvent =
  | { event: "lead_submitted"; source_page: string }
  | { event: "cta_click"; link_text: string; link_url: string }
  | { event: "phone_click"; link_url: string }
  | { event: "email_click"; link_url: string }

export type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  loaded: boolean
  version: string
  push?: Fbq
}

export type AnalyticsWindow = Window & {
  dataLayer?: unknown[]
  gtag?: (...args: unknown[]) => void
  fbq?: Fbq
  _fbq?: Fbq
  /** Set by ConsentProvider; undefined when tracking is off (no banner). */
  __spConsent?: ConsentChoice | null
}

const browserWindow = () =>
  typeof window === "undefined" ? undefined : (window as AnalyticsWindow)

/** Sends one event if the visitor consented; false when nothing was sent. */
export function track(
  event: AnalyticsEvent,
  win: AnalyticsWindow | undefined = browserWindow()
): boolean {
  const consent = win?.__spConsent
  if (!win || !consent) return false
  let sent = false
  if (consent.analytics) {
    ;(win.dataLayer ??= []).push({ ...event })
    const { event: name, ...params } = event
    win.gtag?.("event", name, params)
    sent = true
  }
  if (consent.marketing && event.event === "lead_submitted" && win.fbq) {
    win.fbq("track", "Lead")
    sent = true
  }
  return sent
}

const CTA_PATHS = new Set(["/contact"])

/** The event for a click on a link (phone, email, contact CTA), or null. */
export function classifyClick(
  href: string,
  text: string
): AnalyticsEvent | null {
  const url = href.trim()
  if (/^tel:/i.test(url)) return { event: "phone_click", link_url: url }
  if (/^mailto:/i.test(url)) return { event: "email_click", link_url: url }
  const path = url.split(/[?#]/)[0] ?? url
  if (CTA_PATHS.has(path) || /#contact$/i.test(url))
    return {
      event: "cta_click",
      link_text: text.replace(/\s+/g, " ").trim().slice(0, 100),
      link_url: url,
    }
  return null
}
