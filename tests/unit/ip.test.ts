import { describe, expect, it } from "vitest"

import { clientIp } from "@/server/lib/ip"

describe("clientIp (spec §4)", () => {
  it("uses the first X-Forwarded-For value", () => {
    expect(
      clientIp(new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.2" }))
    ).toBe("203.0.113.7")
  })

  it("falls back to X-Real-IP, then null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.1" }))).toBe(
      "198.51.100.1"
    )
    expect(clientIp(new Headers({ "x-forwarded-for": "" }))).toBeNull()
    expect(clientIp(new Headers())).toBeNull()
  })
})
