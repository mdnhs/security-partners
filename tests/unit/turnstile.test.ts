import { describe, expect, it, vi } from "vitest"

import {
  TURNSTILE_SITEVERIFY_URL,
  verifyTurnstileToken,
} from "@/server/lib/turnstile"

const reply = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe("verifyTurnstileToken (server-side siteverify)", () => {
  it("posts secret, token and remote IP; true only for success:true", async () => {
    const fetchImpl = reply({ success: true })
    expect(
      await verifyTurnstileToken(
        { secret: "sec", token: "tok", ip: "203.0.113.7" },
        fetchImpl as unknown as typeof fetch
      )
    ).toBe(true)
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(TURNSTILE_SITEVERIFY_URL)
    expect(init.method).toBe("POST")
    const body = init.body as URLSearchParams
    expect(body.get("secret")).toBe("sec")
    expect(body.get("response")).toBe("tok")
    expect(body.get("remoteip")).toBe("203.0.113.7")
  })

  it("false for success:false, a non-2xx answer, junk JSON or a network error", async () => {
    const run = (f: unknown) =>
      verifyTurnstileToken(
        { secret: "sec", token: "tok", ip: null },
        f as typeof fetch
      )
    expect(
      await run(
        reply({ success: false, "error-codes": ["invalid-input-response"] })
      )
    ).toBe(false)
    expect(await run(reply({ success: true }, 500))).toBe(false)
    expect(await run(vi.fn(async () => new Response("<html>")))).toBe(false)
    expect(
      await run(
        vi.fn(async () => {
          throw new TypeError("fetch failed")
        })
      )
    ).toBe(false)
  })

  it("a missing token is false without calling Cloudflare", async () => {
    const fetchImpl = reply({ success: true })
    expect(
      await verifyTurnstileToken(
        { secret: "sec", token: undefined, ip: null },
        fetchImpl as unknown as typeof fetch
      )
    ).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
