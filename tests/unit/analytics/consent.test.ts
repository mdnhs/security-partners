import { describe, expect, it } from "vitest"

import {
  consentCookie,
  consentMaxAgeSeconds,
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
  const SIX = consentMaxAgeSeconds(6)

  it("round-trips a choice under its version", () => {
    const raw = encodeConsent({ analytics: true, marketing: false }, NOW, 1)
    expect(raw).toBe(`1.1.0.${Math.floor(NOW / 1000)}`)
    expect(readConsent(raw, NOW + DAY, 1)).toEqual({
      analytics: true,
      marketing: false,
    })
    expect(encodeConsent({ analytics: false, marketing: true }, NOW, 7)).toBe(
      `7.0.1.${Math.floor(NOW / 1000)}`
    )
  })

  it("readConsent ignores a cookie from an older version", () => {
    const raw = encodeConsent({ analytics: true, marketing: false }, NOW, 1)
    expect(readConsent(raw, NOW, 2)).toBeNull()
    expect(
      readConsent(
        encodeConsent({ analytics: true, marketing: true }, NOW, 2),
        NOW,
        2
      )
    ).not.toBeNull()
  })

  it("expires after the re-consent interval (6 months by default); ignores the future and junk", () => {
    const raw = encodeConsent({ analytics: true, marketing: true }, NOW, 1)
    expect(readConsent(raw, NOW + 179 * DAY, 1)).not.toBeNull()
    expect(readConsent(raw, NOW + 181 * DAY, 1)).toBeNull()
    expect(
      readConsent(raw, NOW + 59 * DAY, 1, consentMaxAgeSeconds(2))
    ).not.toBeNull()
    expect(
      readConsent(raw, NOW + 61 * DAY, 1, consentMaxAgeSeconds(2))
    ).toBeNull()
    expect(readConsent(`2.1.1.${Math.floor(NOW / 1000)}`, NOW, 1)).toBeNull()
    expect(readConsent(raw, NOW - DAY, 1)).toBeNull()
    for (const junk of [undefined, null, "", "1.2.0.1", "x", "1.1.1"])
      expect(readConsent(junk, NOW, 1)).toBeNull()
  })

  it("max-age is reconsentMonths × 30 days", () => {
    expect(SIX).toBe(180 * 86_400)
    expect(consentMaxAgeSeconds(1)).toBe(30 * 86_400)
  })

  it("max-age follows reconsentMonths", () => {
    const c = { analytics: true, marketing: false }
    expect(
      consentCookie(c, NOW, { version: 1, maxAgeSeconds: 2 * 30 * 86400 })
    ).toContain("Max-Age=5184000")
  })

  it("is a site-wide, Lax cookie carrying the version; Secure on https", () => {
    const choice = { analytics: false, marketing: false }
    expect(consentCookie(choice, NOW, { version: 1, maxAgeSeconds: SIX })).toBe(
      `sp_consent=1.0.0.${Math.floor(NOW / 1000)}; Max-Age=15552000; Path=/; SameSite=Lax`
    )
    expect(
      consentCookie(choice, NOW, {
        version: 3,
        maxAgeSeconds: SIX,
        secure: true,
      })
    ).toBe(
      `sp_consent=3.0.0.${Math.floor(NOW / 1000)}; Max-Age=15552000; Path=/; SameSite=Lax; Secure`
    )
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
