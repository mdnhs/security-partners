import {
  CONSENT_DEFAULTS,
  type ConsentChoice,
  consentModeUpdate,
} from "./consent"
import type { TrackingSettings } from "@/lib/schemas/settings/tracking"

import type { AnalyticsWindow, Fbq } from "./events"

// Loads GTM / GA4 / Meta Pixel after matching consent (spec §10).

export type TrackingIds = {
  gtmId: string | null
  ga4Id: string | null
  metaPixelId: string | null
}

/** The IDs to load: each one only while its channel switch is on. */
export function trackingIds(t: TrackingSettings): TrackingIds {
  return {
    gtmId: t.gtmEnabled ? t.gtmId : null,
    ga4Id: t.ga4Enabled ? t.ga4Id : null,
    metaPixelId: t.metaEnabled ? t.metaPixelId : null,
  }
}

/** `/?sp_tracking_test=<id>`: the admin's "Send test event" probe. */
export const TRACKING_TEST_PARAM = "sp_tracking_test"

/** The probe's id from a location.search string, or null when absent or malformed. */
export function trackingTestId(search: string): string | null {
  const id = new URLSearchParams(search).get(TRACKING_TEST_PARAM)
  return id && /^[A-Za-z0-9-]{8,40}$/.test(id) ? id : null
}

const TRACKING_TEST_EVENT = "tracking_test"

export const GTM_SRC = (id: string) =>
  `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`
export const GA4_SRC = (id: string) =>
  `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`
export const META_PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js"

const hasScript = (doc: Document, src: string) =>
  [...doc.querySelectorAll<HTMLScriptElement>("script[data-sp-src]")].some(
    (script) => script.dataset.spSrc === src
  )

// startTracking runs again whenever the choice changes: send the probe once.
const hasTestEvent = (win: AnalyticsWindow, testId: string) =>
  win.dataLayer!.some((entry) => {
    const e = entry as { event?: unknown; test_id?: unknown }
    return e.event === TRACKING_TEST_EVENT && e.test_id === testId
  })

function injectScript(doc: Document, src: string) {
  const script = doc.createElement("script")
  script.async = true
  script.src = src
  script.dataset.spSrc = src
  doc.head.appendChild(script)
}

function ensureGtag(win: AnalyticsWindow) {
  win.dataLayer ??= []
  if (win.gtag) return
  const layer = win.dataLayer
  win.gtag = function gtag() {
    // gtag.js only reads `arguments` objects from the dataLayer.
    // eslint-disable-next-line prefer-rest-params
    layer.push(arguments)
  }
  win.gtag("consent", "default", CONSENT_DEFAULTS)
}

function installFbq(win: AnalyticsWindow) {
  const fbq = ((...args: unknown[]) => {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  }) as Fbq
  fbq.queue = []
  fbq.loaded = true
  fbq.version = "2.0"
  fbq.push = fbq
  win.fbq = fbq
  win._fbq = fbq
}

/** Starts what `choice` allows; idempotent. Returns the tags loaded by this call. */
export function startTracking(
  ids: TrackingIds,
  choice: ConsentChoice,
  env: { win: AnalyticsWindow; doc: Document; search?: string }
): string[] {
  const { win, doc } = env
  const loaded: string[] = []
  if (!choice.analytics && !choice.marketing) return loaded
  ensureGtag(win)
  win.gtag!("consent", "update", consentModeUpdate(choice))
  // The test probe needs analytics consent like any other event.
  const testId = choice.analytics
    ? trackingTestId(env.search ?? win.location.search)
    : null
  if (testId && !hasTestEvent(win, testId))
    win.dataLayer!.push({ event: TRACKING_TEST_EVENT, test_id: testId })
  if (choice.analytics && ids.gtmId && !hasScript(doc, GTM_SRC(ids.gtmId))) {
    win.dataLayer!.push({ "gtm.start": Date.now(), event: "gtm.js" })
    injectScript(doc, GTM_SRC(ids.gtmId))
    loaded.push("gtm")
  }
  if (choice.analytics && ids.ga4Id && !hasScript(doc, GA4_SRC(ids.ga4Id))) {
    injectScript(doc, GA4_SRC(ids.ga4Id))
    win.gtag!("js", new Date())
    if (testId) win.gtag!("config", ids.ga4Id, { debug_mode: true })
    else win.gtag!("config", ids.ga4Id)
    loaded.push("ga4")
  }
  if (choice.marketing && ids.metaPixelId && !hasScript(doc, META_PIXEL_SRC)) {
    if (!win.fbq) installFbq(win)
    injectScript(doc, META_PIXEL_SRC)
    win.fbq!("init", ids.metaPixelId)
    win.fbq!("track", "PageView")
    loaded.push("meta")
  }
  return loaded
}
