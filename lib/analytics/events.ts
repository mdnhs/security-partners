import type { ConsentChoice } from "./consent"

// Typed dataLayer event catalogue (spec §10).

export const ANALYTICS_EVENTS = [
  "lead_submitted",
  "cta_click",
  "phone_click",
  "email_click",
  "page_view_virtual",
  "tracking_test",
] as const

export type AnalyticsEvent =
  | { event: "lead_submitted"; source_page: string }
  | { event: "cta_click"; link_text: string; link_url: string }
  | { event: "phone_click"; link_url: string }
  | { event: "email_click"; link_url: string }
  | { event: "page_view_virtual"; page_path: string; page_title: string }
  | { event: "tracking_test"; test_id: string }

/**
 * What each event means and what it maps to in GA4 and Meta (Marketing ›
 * Event catalogue). Keep docs/gtm-container.json in step: one Custom Event
 * trigger and one GA4 Event tag per row, a Data Layer Variable per param
 * (tests/unit/analytics/catalogue.test.ts checks both).
 */
export const EVENT_CATALOGUE: readonly {
  event: AnalyticsEvent["event"]
  firesWhen: string
  params: readonly string[]
  ga4: string
  meta: string | null
}[] = [
  {
    event: "page_view_virtual",
    firesWhen: "each page change after the first",
    params: ["page_path", "page_title"],
    ga4: "page_view",
    meta: "PageView",
  },
  {
    event: "lead_submitted",
    firesWhen: "the contact form was accepted",
    params: ["source_page"],
    ga4: "generate_lead",
    meta: "Lead",
  },
  {
    event: "cta_click",
    firesWhen: "links to /contact",
    params: ["link_text", "link_url"],
    ga4: "select_content",
    meta: null,
  },
  {
    event: "phone_click",
    firesWhen: "tel: links",
    params: ["link_url"],
    ga4: "contact",
    meta: "Contact",
  },
  {
    event: "email_click",
    firesWhen: "mailto: links",
    params: ["link_url"],
    ga4: "contact",
    meta: "Contact",
  },
  {
    event: "tracking_test",
    firesWhen: "the admin's Send test event",
    params: ["test_id"],
    ga4: "tracking_test",
    meta: null,
  },
  // D4.2 integration point: the `newsletter_sign_up` row goes here
  // ("newsletter signup accepted" | method | sign_up | CompleteRegistration),
  // with its trigger, GA4 tag and `method` variable in docs/gtm-container.json.
]

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
