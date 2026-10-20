import { describe, expect, it } from "vitest"

import {
  absoluteUrl,
  isOgKind,
  ogImagePath,
  originOf,
  siteOrigin,
} from "@/lib/seo/urls"

describe("site URLs", () => {
  it("originOf keeps only http(s) origins", () => {
    expect(originOf("https://www.example.ie/path?x=1")).toBe(
      "https://www.example.ie"
    )
    expect(originOf("http://127.0.0.1:3100")).toBe("http://127.0.0.1:3100")
    expect(originOf("javascript:alert(1)")).toBeNull()
    expect(originOf("not a url")).toBeNull()
    expect(originOf(null)).toBeNull()
  })

  it("siteOrigin prefers the production URL, else the deployment origin", () => {
    expect(siteOrigin("https://www.example.ie/", "http://localhost:3000")).toBe(
      "https://www.example.ie"
    )
    expect(siteOrigin(null, "http://localhost:3000/")).toBe(
      "http://localhost:3000"
    )
    expect(() => siteOrigin(null, "nope")).toThrow(/No site origin/)
  })

  it("absoluteUrl and the OG image path", () => {
    expect(absoluteUrl("https://x.ie", "/")).toBe("https://x.ie/")
    expect(absoluteUrl("https://x.ie", "/services/a")).toBe(
      "https://x.ie/services/a"
    )
    expect(ogImagePath("service", "alarm-responses")).toBe(
      "/og/service/alarm-responses"
    )
    expect(isOgKind("article")).toBe(true)
    expect(isOgKind("toString")).toBe(false)
  })
})
