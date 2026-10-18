import { describe, expect, it } from "vitest"

import {
  CONSENT_MAX_AGE,
  consentCookie,
  consentModeUpdate,
  cookieDomains,
  cookieValue,
  encodeConsent,
  isTrackingCookie,
  readConsent,
  withdrawn,
} from "@/lib/analytics/consent"

const NOW = Date.UTC(2026, 9, 16, 9)
const DAY = 86_400_000

describe("consent cookie", () => {
  it("round-trips a choice", () => {
    const raw = encodeConsent({ analytics: true, marketing: false }, NOW)
    expect(raw).toBe(`1.1.0.${Math.floor(NOW / 1000)}`)
    expect(readConsent(raw, NOW + DAY)).toEqual({
      analytics: true,
      marketing: false,
    })
  })

  it("expires after 6 months; ignores other versions, the future and junk", () => {
    const raw = encodeConsent({ analytics: true, marketing: true }, NOW)
    expect(readConsent(raw, NOW + 179 * DAY)).not.toBeNull()
    expect(readConsent(raw, NOW + 181 * DAY)).toBeNull()
    expect(readConsent(`2.1.1.${Math.floor(NOW / 1000)}`, NOW)).toBeNull()
    expect(readConsent(raw, NOW - DAY)).toBeNull()
    for (const junk of [undefined, null, "", "1.2.0.1", "x", "1.1.1"])
      expect(readConsent(junk, NOW)).toBeNull()
  })

  it("is a 6-month, site-wide, Lax cookie; Secure on https", () => {
    const choice = { analytics: false, marketing: false }
    expect(CONSENT_MAX_AGE).toBe(180 * 86_400)
    expect(consentCookie(choice, NOW, false)).toBe(
      `sp_consent=1.0.0.${Math.floor(NOW / 1000)}; Max-Age=15552000; Path=/; SameSite=Lax`
    )
    expect(consentCookie(choice, NOW, true).endsWith("; Secure")).toBe(true)
    expect(cookieValue("a=1; sp_consent=1.0.0.5; b=2", "sp_consent")).toBe(
      "1.0.0.5"
    )
  })

  it("Consent Mode mirrors the choice", () => {
    expect(consentModeUpdate({ analytics: true, marketing: false })).toEqual({
      analytics_storage: "granted",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    })
  })

  it("withdrawal = taking back something granted", () => {
    const all = { analytics: true, marketing: true }
    const none = { analytics: false, marketing: false }
    expect(withdrawn(null, none)).toBe(false)
    expect(withdrawn(none, all)).toBe(false)
    expect(withdrawn(all, { analytics: true, marketing: false })).toBe(true)
  })

  it("knows GA/Meta cookies and the domains to clear them on", () => {
    for (const name of ["_ga", "_ga_ABC", "_gid", "_gcl_au", "_fbp", "_fbc"])
      expect(isTrackingCookie(name), name).toBe(true)
    expect(isTrackingCookie("sp_consent")).toBe(false)
    expect(cookieDomains("www.securitypartnersltd.com")).toEqual([
      "www.securitypartnersltd.com",
      ".www.securitypartnersltd.com",
      ".securitypartnersltd.com",
    ])
  })
})
