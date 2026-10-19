// The consent cookie and Google Consent Mode values (spec §10: own
// lightweight manager). The choice is kept for the re-consent interval
// (settings.consent.reconsentMonths, 1–6 months) and only under the current
// consent version (settings.consent.version). Isomorphic, no React.

export const CONSENT_COOKIE = "sp_consent"
const SKEW_MS = 5 * 60_000
/** The longest re-consent interval (settings.consent.reconsentMonths max). */
export const MAX_RECONSENT_MONTHS = 6

export type ConsentChoice = { analytics: boolean; marketing: boolean }

/** Cookie Max-Age for a re-consent interval: a month counts as 30 days. */
export const consentMaxAgeSeconds = (reconsentMonths: number) =>
  reconsentMonths * 30 * 86_400

/** "<version>.<analytics 0|1>.<marketing 0|1>.<unix seconds>" */
export function encodeConsent(
  choice: ConsentChoice,
  nowMs: number,
  version: number
): string {
  return `${version}.${choice.analytics ? 1 : 0}.${choice.marketing ? 1 : 0}.${Math.floor(nowMs / 1000)}`
}

/**
 * The stored choice, or null when missing, malformed, from the future,
 * older than the re-consent interval, or of another consent version (the
 * owner published a new version: everyone is asked again).
 */
export function readConsent(
  raw: string | null | undefined,
  nowMs: number,
  version: number,
  maxAgeSeconds = consentMaxAgeSeconds(MAX_RECONSENT_MONTHS)
): ConsentChoice | null {
  const match = /^(\d+)\.([01])\.([01])\.(\d+)$/.exec(raw ?? "")
  if (!match || Number(match[1]) !== version) return null
  const age = nowMs - Number(match[4]) * 1000
  if (age < -SKEW_MS || age > maxAgeSeconds * 1000) return null
  return { analytics: match[2] === "1", marketing: match[3] === "1" }
}

export function consentCookie(
  choice: ConsentChoice,
  nowMs: number,
  {
    version,
    maxAgeSeconds,
    secure = false,
  }: { version: number; maxAgeSeconds: number; secure?: boolean }
): string {
  return `${CONSENT_COOKIE}=${encodeConsent(choice, nowMs, version)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`
}

export function cookieValue(
  header: string | null | undefined,
  name: string
): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const at = part.indexOf("=")
    if (at > 0 && part.slice(0, at).trim() === name)
      return part.slice(at + 1).trim()
  }
  return undefined
}

/** Google Consent Mode v2 defaults, set before any Google tag loads. */
export const CONSENT_DEFAULTS = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
  wait_for_update: 500,
} as const

const state = (on: boolean) => (on ? "granted" : "denied")

export function consentModeUpdate(choice: ConsentChoice) {
  return {
    analytics_storage: state(choice.analytics),
    ad_storage: state(choice.marketing),
    ad_user_data: state(choice.marketing),
    ad_personalization: state(choice.marketing),
  } as const
}

/** True when `next` takes back a category `previous` granted. */
export function withdrawn(
  previous: ConsentChoice | null,
  next: ConsentChoice
): boolean {
  return (
    (!!previous?.analytics && !next.analytics) ||
    (!!previous?.marketing && !next.marketing)
  )
}

const TRACKING_COOKIES = [/^_ga(_|$)/, /^_gid$/, /^_gcl_/, /^_fbp$/, /^_fbc$/]

export const isTrackingCookie = (name: string) =>
  TRACKING_COOKIES.some((re) => re.test(name))

/** GA/Meta set cookies on the registrable domain: try the host and each parent. */
export function cookieDomains(hostname: string): string[] {
  const labels = hostname.split(".")
  if (labels.length < 2) return [hostname]
  const out = [hostname]
  for (let i = 0; i <= labels.length - 2; i++)
    out.push(`.${labels.slice(i).join(".")}`)
  return out
}

export function clearTrackingCookies(
  doc: { cookie: string },
  hostname: string
): void {
  const names = doc.cookie
    .split(";")
    .map((part) => part.split("=")[0]!.trim())
    .filter(isTrackingCookie)
  for (const name of names) {
    doc.cookie = `${name}=; Max-Age=0; Path=/`
    for (const domain of cookieDomains(hostname))
      doc.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}`
  }
}
