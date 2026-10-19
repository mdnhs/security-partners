import { z } from "zod"

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

/** C0/C1 controls, DEL, line/paragraph separators and bidi controls. */
const UNSAFE =
  /[\u0000-\u001F\u007F-\u009F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g

/** Plain one-line text: unsafe characters removed, trimmed, capped at 200. */
export function cleanAttributionText(value: string): string {
  return value.replace(UNSAFE, "").trim().slice(0, MAX)
}

/** Only an http(s) referrer from another origin, as origin + path (no query, no fragment). */
function externalReferrer(referrer: string, origin: string): string | null {
  if (!referrer) return null
  let url: URL
  try {
    url = new URL(referrer)
  } catch {
    return null
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null
  if (url.origin === origin) return null
  return cleanAttributionText(url.origin + url.pathname) || null
}

/**
 * Stores the first touch of this browser session. First touch wins: an
 * existing value is never overwritten. Storage errors (blocked, full) are
 * swallowed: attribution must never break the page.
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
      landingPath: cleanAttributionText(loc.pathname) || "/",
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

const NO_STORAGE: Pick<Storage, "getItem"> = { getItem: () => null }

/** window.sessionStorage, or an empty store when the browser blocks it (the getter itself can throw). */
export function sessionStore(): Pick<Storage, "getItem" | "setItem"> {
  try {
    return window.sessionStorage
  } catch {
    return { ...NO_STORAGE, setItem: () => undefined }
  }
}

/**
 * Server side: the submitted attribution as stored. Same limits as the
 * client (oversized → 422), then normalised to plain one-line text; a
 * referrer that is not an http(s) URL is dropped.
 */
export const attributionSubmission = attributionSchema.transform(
  (a): Attribution => {
    const utm: Attribution["utm"] = {}
    for (const key of UTM_KEYS) {
      const value = cleanAttributionText(a.utm[key] ?? "")
      if (value) utm[key] = value
    }
    const referrer = a.referrer ? cleanAttributionText(a.referrer) : ""
    return {
      referrer: /^https?:\/\/[^/\s]/i.test(referrer) ? referrer : null,
      landingPath: cleanAttributionText(a.landingPath) || "/",
      utm,
      capturedAt: a.capturedAt,
    }
  }
)
