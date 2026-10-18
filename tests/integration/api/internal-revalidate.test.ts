import { beforeEach, describe, expect, it, vi } from "vitest"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({
  revalidateTag,
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import { app } from "@/server/api/app"
import {
  SIGNATURE_HEADER,
  signInternalRequest,
  TIMESTAMP_HEADER,
} from "@/server/lib/internal-signature"
import { revalidateViaApi } from "@/server/lib/scheduler"

const send = (body: string, headers: Record<string, string>) =>
  app.request("/api/v1/internal/revalidate", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  })

const signed = (body: string, now = Date.now()) => {
  const { timestamp, signature } = signInternalRequest(body, now)
  return { [TIMESTAMP_HEADER]: timestamp, [SIGNATURE_HEADER]: signature }
}

beforeEach(() => {
  revalidateTag.mockClear()
  vi.unstubAllGlobals()
})

describe("POST /api/v1/internal/revalidate (ledger: scheduler → signed route)", () => {
  it("expires the signed tags", async () => {
    const body = JSON.stringify({ tags: ["articles", "article:x"] })
    const res = await send(body, signed(body))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, count: 2 })
    expect(revalidateTag.mock.calls).toEqual([
      ["articles", { expire: 0 }],
      ["article:x", { expire: 0 }],
    ])
  })

  it("refuses unsigned, forged, replayed and tampered requests (401)", async () => {
    const body = JSON.stringify({ tags: ["articles"] })
    expect((await send(body, {})).status).toBe(401)
    expect(
      (
        await send(body, {
          ...signed(body),
          [SIGNATURE_HEADER]: "x".repeat(43),
        })
      ).status
    ).toBe(401)
    expect(
      (await send(body, signed(body, Date.now() - 10 * 60_000))).status
    ).toBe(401)
    expect(
      (await send(JSON.stringify({ tags: ["page:home"] }), signed(body))).status
    ).toBe(401)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("refuses timestamps from the future and bodies over 64 KB; no CORS", async () => {
    const body = JSON.stringify({ tags: ["articles"] })
    expect(
      (await send(body, signed(body, Date.now() + 10 * 60_000))).status
    ).toBe(401)
    const huge = JSON.stringify({ tags: ["x".repeat(70 * 1024)] })
    expect((await send(huge, signed(huge))).status).toBe(413)

    const ok = await send(body, {
      ...signed(body),
      origin: "https://evil.example",
    })
    expect(ok.status).toBe(200)
    expect(ok.headers.get("access-control-allow-origin")).toBeNull()
    const preflight = await app.request("/api/v1/internal/revalidate", {
      method: "OPTIONS",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "POST",
      },
    })
    expect(preflight.headers.get("access-control-allow-origin")).toBeNull()
    expect(revalidateTag).toHaveBeenCalledTimes(1)
  })

  it("validates the signed body (422)", async () => {
    const empty = JSON.stringify({ tags: [] })
    expect((await send(empty, signed(empty))).status).toBe(422)
    expect((await send("nope", signed("nope"))).status).toBe(422)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("is what the scheduler calls (revalidateViaApi → fetch → route)", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: RequestInfo | URL, init?: RequestInit) =>
        app.request(new URL(String(input)).pathname, init)
    )
    await revalidateViaApi(["articles"])
    expect(revalidateTag).toHaveBeenCalledWith("articles", { expire: 0 })
  })
})
