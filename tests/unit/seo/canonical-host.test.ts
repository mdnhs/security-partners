import { describe, expect, it } from "vitest"

import {
  canonicalHostRedirect,
  siteHostFrom,
} from "@/lib/seo/canonical-host"

const base = {
  host: "example.ie",
  proto: "https",
  preferred: "www" as const,
  siteHost: "example.ie",
  pathAndSearch: "/a?b=1",
}

describe("siteHostFrom", () => {
  it("is the production host without www, or null", () => {
    expect(siteHostFrom("https://www.Example.ie/home")).toBe("example.ie")
    expect(siteHostFrom(null)).toBeNull()
    expect(siteHostFrom("nonsense")).toBeNull()
  })
})

describe("canonicalHostRedirect", () => {
  it("sends the other variant to the preferred https address", () => {
    expect(canonicalHostRedirect(base)).toBe("https://www.example.ie/a?b=1")
    expect(
      canonicalHostRedirect({
        ...base,
        host: "www.example.ie:443",
        preferred: "apex",
      })
    ).toBe("https://example.ie/a?b=1")
  })

  it("upgrades http on the preferred host, but ignores an unknown protocol", () => {
    const right = { ...base, host: "www.example.ie" }
    expect(canonicalHostRedirect({ ...right, proto: "http" })).toBe(
      "https://www.example.ie/a?b=1"
    )
    expect(canonicalHostRedirect({ ...right, proto: null })).toBeNull()
    expect(canonicalHostRedirect(right)).toBeNull()
  })

  it("does nothing when off, unconfigured, foreign, an IP, or a protocol-relative path", () => {
    expect(canonicalHostRedirect({ ...base, preferred: "off" })).toBeNull()
    expect(canonicalHostRedirect({ ...base, siteHost: null })).toBeNull()
    expect(
      canonicalHostRedirect({ ...base, host: "staging.example.ie" })
    ).toBeNull()
    expect(canonicalHostRedirect({ ...base, host: "10.0.0.1:3000" })).toBeNull()
    expect(
      canonicalHostRedirect({ ...base, pathAndSearch: "//evil.com" })
    ).toBeNull()
  })
})
