import { HTTPException } from "hono/http-exception"
import { describe, expect, it } from "vitest"

import { createApp } from "@/server/api/app"

// Ledger minor (Phase 1 Task 5): onError dropped HTTPException headers.
const app = createApp()
app.get("/v1/__test/http-429", () => {
  throw new HTTPException(429, {
    message: "Slow down",
    res: new Response(null, {
      headers: { "Retry-After": "42", "content-type": "text/plain" },
    }),
  })
})

describe("onError keeps HTTPException headers", () => {
  it("returns the envelope with the exception's Retry-After header", async () => {
    const res = await app.request("/api/v1/__test/http-429")
    expect(res.status).toBe(429)
    expect(res.headers.get("retry-after")).toBe("42")
    expect(res.headers.get("content-type")).toMatch(/^application\/json/)
    const body = (await res.json()) as {
      error: { code: string; message: string }
    }
    expect(body.error).toMatchObject({
      code: "RATE_LIMITED",
      message: "Slow down",
    })
  })
})
