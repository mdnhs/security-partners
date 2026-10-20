import { describe, expect, it } from "vitest"

import {
  ATTRIBUTION_KEY,
  attributionSchema,
  captureAttribution,
  cleanAttributionText,
  clearAttribution,
  readAttribution,
  submittedAttribution,
  UTM_KEYS,
} from "@/lib/leads/attribution"

function memoryStore() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  }
}

const ORIGIN = "https://www.securitypartners.ie"
const loc = (pathname: string, search = "") => ({
  pathname,
  search,
  origin: ORIGIN,
})
const NOW = new Date("2026-10-20T09:30:00.000Z")

describe("lead attribution (D3.1)", () => {
  it("exports the storage key and the five UTM keys", () => {
    expect(ATTRIBUTION_KEY).toBe("sp_attribution")
    expect(UTM_KEYS).toEqual([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ])
  })

  it("captures UTMs and landing path on first visit only", () => {
    const store = memoryStore()
    captureAttribution(
      loc(
        "/services/static-guarding",
        "?utm_source=google&utm_medium=cpc&utm_campaign=autumn+26&utm_term=guards%20dublin&utm_content=ad1&gclid=abc&other=x"
      ),
      "",
      store,
      NOW
    )
    expect(readAttribution(store)).toEqual({
      referrer: null,
      landingPath: "/services/static-guarding",
      utm: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "autumn 26",
        utm_term: "guards dublin",
        utm_content: "ad1",
      },
      capturedAt: "2026-10-20T09:30:00.000Z",
    })

    // A later page in the same session never overwrites the first touch.
    captureAttribution(
      loc("/contact", "?utm_source=bing"),
      "https://bing.com/",
      store,
      new Date("2026-10-20T10:00:00.000Z")
    )
    const kept = readAttribution(store)!
    expect(kept.landingPath).toBe("/services/static-guarding")
    expect(kept.utm.utm_source).toBe("google")
    expect(kept.referrer).toBeNull()
  })

  it("stores no empty UTM values", () => {
    const store = memoryStore()
    captureAttribution(loc("/", "?utm_source=&utm_medium=%20%20"), "", store)
    expect(readAttribution(store)!.utm).toEqual({})
  })

  it("drops internal referrers; keeps external origin+path without query", () => {
    const store = memoryStore()
    captureAttribution(loc("/"), "https://google.com/search?q=secret", store)
    expect(readAttribution(store)!.referrer).toBe("https://google.com/search")
    expect(store.data.get(ATTRIBUTION_KEY)).not.toContain("secret")

    const internal = memoryStore()
    captureAttribution(loc("/contact"), `${ORIGIN}/about?x=1#top`, internal)
    expect(readAttribution(internal)!.referrer).toBeNull()

    const fragment = memoryStore()
    captureAttribution(loc("/"), "https://t.co/abc#frag", fragment)
    expect(readAttribution(fragment)!.referrer).toBe("https://t.co/abc")
  })

  it("drops javascript:, data: and unparseable referrers", () => {
    for (const referrer of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "not a url",
      "ftp://files.example.com/x",
    ]) {
      const store = memoryStore()
      captureAttribution(loc("/"), referrer, store)
      expect(readAttribution(store)!.referrer).toBeNull()
    }
  })

  it("caps values at 200 and strips control characters", () => {
    const store = memoryStore()
    const huge = "a".repeat(10_000)
    captureAttribution(
      loc(
        `/${"p".repeat(500)}`,
        `?utm_source=${huge}&utm_medium=${encodeURIComponent("e\u0000ma\u0007il\u202E\n")}&utm_campaign=${encodeURIComponent("  <script>alert(1)</script>  ")}`
      ),
      `https://evil.example/${"r".repeat(500)}`,
      store
    )
    const a = readAttribution(store)!
    expect(a.utm.utm_source).toHaveLength(200)
    expect(a.utm.utm_medium).toBe("email")
    // Kept as plain text: escaping happens where it is shown.
    expect(a.utm.utm_campaign).toBe("<script>alert(1)</script>")
    expect(a.landingPath).toHaveLength(200)
    expect(a.referrer).toHaveLength(200)
    expect(a.referrer!.startsWith("https://evil.example/")).toBe(true)
  })

  it("storage that throws does not break", () => {
    const throwing = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError")
      },
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError")
      },
    }
    expect(() =>
      captureAttribution(loc("/", "?utm_source=x"), "", throwing)
    ).not.toThrow()
    expect(readAttribution(throwing)).toBeNull()

    const fullOnly = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError")
      },
    }
    expect(() =>
      captureAttribution(loc("/", "?utm_source=x"), "", fullOnly)
    ).not.toThrow()
  })

  it("readAttribution returns null for missing, corrupt or invalid values", () => {
    const store = memoryStore()
    expect(readAttribution(store)).toBeNull()
    store.data.set(ATTRIBUTION_KEY, "{not json")
    expect(readAttribution(store)).toBeNull()
    store.data.set(ATTRIBUTION_KEY, JSON.stringify({ landingPath: "/" }))
    expect(readAttribution(store)).toBeNull()
    store.data.set(
      ATTRIBUTION_KEY,
      JSON.stringify({
        referrer: null,
        landingPath: "x".repeat(201),
        utm: {},
        capturedAt: NOW.toISOString(),
      })
    )
    expect(readAttribution(store)).toBeNull()
  })

  it("the schema caps each value at 200 and allows only the five UTM keys", () => {
    const base = {
      referrer: null,
      landingPath: "/",
      utm: {},
      capturedAt: NOW.toISOString(),
    }
    expect(attributionSchema.safeParse(base).success).toBe(true)
    expect(
      attributionSchema.safeParse({
        ...base,
        utm: { utm_source: "x".repeat(201) },
      }).success
    ).toBe(false)
    expect(
      attributionSchema.safeParse({ ...base, utm: { gclid: "abc" } }).success
    ).toBe(false)
    expect(
      attributionSchema.safeParse({ ...base, capturedAt: "yesterday" }).success
    ).toBe(false)
  })
})

describe("lead attribution review fixes (D3.1 I2, M1-M3)", () => {
  const isWellFormed = (s: string) =>
    !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(
      s
    )

  it("never splits an emoji at the cap and drops lone surrogates", () => {
    const atCap = cleanAttributionText(`${"a".repeat(199)}\u{1F680}`)
    expect(atCap).toBe("a".repeat(199))
    expect(isWellFormed(atCap)).toBe(true)
    const fits = cleanAttributionText(`${"a".repeat(198)}\u{1F680}`)
    expect(fits).toBe(`${"a".repeat(198)}\u{1F680}`)
    expect(fits).toHaveLength(200)
    expect(cleanAttributionText("\ud800x\udc00y")).toBe("xy")

    const store = memoryStore()
    captureAttribution(
      loc(
        "/",
        `?utm_content=${"a".repeat(199)}${encodeURIComponent("\u{1F680}")}`
      ),
      "",
      store
    )
    const a = readAttribution(store)!
    expect(isWellFormed(a.utm.utm_content!)).toBe(true)
  })

  it("strips zero-width, directional marks and BOM", () => {
    expect(cleanAttributionText("g​o‌o‍g‎l‏e؜⁠﻿")).toBe("google")
  })

  it("submittedAttribution strips the referrer query, forces a site path and drops invalid input", () => {
    const base = {
      referrer: "https://www.google.com/search?q=secret#frag",
      landingPath: "javascript:alert(1)",
      utm: { utm_source: "\ud800google" },
      capturedAt: NOW.toISOString(),
    }
    expect(submittedAttribution(base)).toEqual({
      referrer: "https://www.google.com/search",
      landingPath: "/",
      utm: { utm_source: "google" },
      capturedAt: NOW.toISOString(),
    })
    expect(
      submittedAttribution({ ...base, landingPath: "https://evil.example/x" })
        ?.landingPath
    ).toBe("/")
    expect(
      submittedAttribution({ ...base, referrer: "data:text/html,x" })?.referrer
    ).toBeNull()
    expect(submittedAttribution(undefined)).toBeNull()
    expect(submittedAttribution(null)).toBeNull()
    expect(submittedAttribution("nope")).toBeNull()
    expect(
      submittedAttribution({ ...base, utm: { utm_source: "x".repeat(201) } })
    ).toBeNull()
  })

  it("clearAttribution removes the key and survives blocked storage", () => {
    const data = new Map([[ATTRIBUTION_KEY, "{}"]])
    clearAttribution({ removeItem: (k: string) => void data.delete(k) })
    expect(data.has(ATTRIBUTION_KEY)).toBe(false)
    expect(() =>
      clearAttribution({
        removeItem: () => {
          throw new DOMException("denied", "SecurityError")
        },
      })
    ).not.toThrow()
  })
})
