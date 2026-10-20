import { z } from "zod"

import type { AnalyticsWindow } from "@/lib/analytics/events"

/**
 * First-touch lead attribution (D3.1): where a visitor first came from
 * (external referrer origin+path, landing path, UTM tags). Captured into
 * sessionStorage on the first page of a visit and sent only with the
 * contact form's POST; it never goes to analytics.
 */
export const ATTRIBUTION_KEY = "sp_attribution"
export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const
export type UtmKey = (typeof UTM_KEYS)[number]

const MAX = 200

export const attributionSchema = z.object({
  referrer: z.string().max(MAX).nullable(),
  landingPath: z.string().max(MAX),
  utm: z.partialRecord(z.enum(UTM_KEYS), z.string().max(MAX)),
  capturedAt: z.iso.datetime(),
})
export type Attribution = z.infer<typeof attributionSchema>

/**
 * C0/C1 controls, DEL, line/paragraph separators, bidi embeddings/isolates
 * and marks (LRM, RLM, ALM), zero-width characters, word joiner and BOM.
 */
const UNSAFE =
  /[\u0000-\u001F\u007F-\u009F\u061C\u200B-\u200F\u2028-\u202E\u2060\u2066-\u2069\uFEFF]/g

/** A UTF-16 surrogate without its partner (Postgres jsonb rejects them). */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

/**
 * Plain one-line text: unsafe characters removed, trimmed, capped at 200
 * UTF-16 units without splitting a surrogate pair (always well-formed).
 */
export function cleanAttributionText(value: string): string {
  return value
    .replace(UNSAFE, "")
    .replace(LONE_SURROGATE, "")
    .trim()
    .slice(0, MAX)
    .replace(LONE_SURROGATE, "")
}

/** An http(s) URL as origin + path (no query, no fragment), else null. */
function webReferrer(raw: string): string | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  return cleanAttributionText(url.origin + url.pathname) || null
}

/** Only an http(s) referrer from another origin, as origin + path. */
function externalReferrer(referrer: string, origin: string): string | null {
  try {
    if (new URL(referrer).origin === origin) return null
  } catch {
    return null
  }
  return webReferrer(referrer)
}

/** A path on this site, else "/". */
function sitePath(raw: string): string {
  const path = cleanAttributionText(raw)
  return path.startsWith("/") ? path : "/"
}

/**
 * Stores the first touch of this browser session. First touch wins: an
 * existing value is never overwritten. Storage errors (blocked, full) are
 * swallowed: attribution must never break the page. Callers capture only
 * with analytics consent (components/attribution-capture.tsx).
 */
export function captureAttribution(
  loc: { pathname: string; search: string; origin: string },
  referrer: string,
  storage: Pick<Storage, "getItem" | "setItem">,
  now: Date = new Date()
): void {
  try {
    if (storage.getItem(ATTRIBUTION_KEY) !== null) return
    const params = new URLSearchParams(loc.search)
    const utm: Attribution["utm"] = {}
    for (const key of UTM_KEYS) {
      const value = cleanAttributionText(params.get(key) ?? "")
      if (value) utm[key] = value
    }
    const value: Attribution = {
      referrer: externalReferrer(referrer, loc.origin),
      landingPath: sitePath(loc.pathname),
      utm,
      capturedAt: now.toISOString(),
    }
    storage.setItem(ATTRIBUTION_KEY, JSON.stringify(value))
  } catch {
    // Blocked or full storage: no attribution for this visit.
  }
}

/** The stored attribution, or null when missing, corrupt or invalid. */
export function readAttribution(
  storage: Pick<Storage, "getItem">
): Attribution | null {
  try {
    const raw = storage.getItem(ATTRIBUTION_KEY)
    if (!raw) return null
    const parsed = attributionSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** Forgets the stored attribution (consent withdrawn); never throws. */
export function clearAttribution(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(ATTRIBUTION_KEY)
  } catch {
    // Blocked storage: nothing stored either.
  }
}

export type AttributionStore = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>

const NO_STORAGE: AttributionStore = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

/** window.sessionStorage, or an empty store when the browser blocks it (the getter itself can throw). */
export function sessionStore(): AttributionStore {
  try {
    return window.sessionStorage
  } catch {
    return NO_STORAGE
  }
}

/**
 * Server side: the submitted attribution as stored, or null when it is
 * missing or invalid (the enquiry is never rejected for it). Values are
 * normalised to plain one-line text, the referrer to an http(s)
 * origin + path, the landing page to a path on this site.
 */
export function submittedAttribution(raw: unknown): Attribution | null {
  if (raw === undefined || raw === null) return null
  const parsed = attributionSchema.safeParse(raw)
  if (!parsed.success) return null
  const a = parsed.data
  const utm: Attribution["utm"] = {}
  for (const key of UTM_KEYS) {
    const value = cleanAttributionText(a.utm[key] ?? "")
    if (value) utm[key] = value
  }
  return {
    referrer: a.referrer ? webReferrer(cleanAttributionText(a.referrer)) : null,
    landingPath: sitePath(a.landingPath),
    utm,
    capturedAt: a.capturedAt,
  }
}

/**
 * The visitor's analytics choice from the ConsentProvider's window
 * contract: true = accepted, false = refused or no choice yet,
 * undefined = not published (tracking off, or the provider has not run).
 */
export function analyticsConsent(): boolean | undefined {
  const consent = (window as AnalyticsWindow).__spConsent
  if (consent === undefined) return undefined
  return consent?.analytics === true
}
