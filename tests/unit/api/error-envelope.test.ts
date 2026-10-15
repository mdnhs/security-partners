import { HTTPException } from "hono/http-exception"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { createApp } from "@/server/api/app"
import { zv } from "@/server/api/validate"
import { AppError, conflict } from "@/server/lib/errors"

const app = createApp()
// Test-only routes on a private app instance.
app.get("/v1/__test/app-error", () => {
  throw new AppError("FORBIDDEN", "Nope")
})
app.get("/v1/__test/conflict", () => {
  throw conflict({ version: 3 })
})
app.get("/v1/__test/http-exception", () => {
  throw new HTTPException(401, { message: "Sign in" })
})
app.get("/v1/__test/boom", () => {
  throw new Error("secret detail /var/app/server.ts:42")
})
app.get("/v1/__test/app-error-internal", () => {
  throw new AppError("INTERNAL", "secret detail /var/app/db.ts:7")
})
app.get("/v1/__test/http-exception-5xx", () => {
  throw new HTTPException(502, { message: "secret upstream detail" })
})
app.post(
  "/v1/__test/validate",
  zv(
    "json",
    z.object({
      slug: z.string().min(1),
      hero: z.object({ heading: z.string() }),
    })
  ),
  (c) => c.json({ ok: true })
)
app.post("/v1/public/__test/echo", async (c) =>
  c.json({ size: (await c.req.text()).length })
)
app.post("/v1/admin/__test/echo", async (c) =>
  c.json({ size: (await c.req.text()).length })
)

const ORIGIN = "http://localhost:3000"

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://sp:sp@127.0.0.1:5432/sp_test"
  process.env.BETTER_AUTH_SECRET =
    "test-secret-0123456789abcdef0123456789abcdef"
  process.env.BETTER_AUTH_URL = ORIGIN
})
afterAll(() => {
  delete process.env.DATABASE_URL
  delete process.env.BETTER_AUTH_SECRET
  delete process.env.BETTER_AUTH_URL
})

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("API error envelope", () => {
  it("GET /api/v1/health/live → 200 {status:ok} without touching the DB", async () => {
    const res = await app.request("/api/v1/health/live")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "ok" })
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("unknown route → 404 envelope with requestId (uuid v7, echoed in X-Request-Id)", async () => {
    const res = await app.request("/api/v1/nope")
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
        requestId: expect.stringMatching(UUID),
      },
    })
    expect(res.headers.get("x-request-id")).toBe(body.error.requestId)
  })

  it("reuses an incoming X-Request-Id", async () => {
    const res = await app.request("/api/v1/nope", {
      headers: { "X-Request-Id": "req-123" },
    })
    expect((await res.json()).error.requestId).toBe("req-123")
  })

  it("thrown AppError → its status and code", async () => {
    const res = await app.request("/api/v1/__test/app-error")
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Nope",
        requestId: expect.any(String),
      },
    })
  })

  it("conflict → 409 with current state", async () => {
    const res = await app.request("/api/v1/__test/conflict")
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe("CONFLICT")
    expect(body.error.current).toEqual({ version: 3 })
  })

  it("HTTPException → mapped code", async () => {
    const res = await app.request("/api/v1/__test/http-exception")
    expect(res.status).toBe(401)
    expect((await res.json()).error).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "Sign in",
    })
  })

  it("unknown error → 500 INTERNAL without message or stack in the body", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const res = await app.request("/api/v1/__test/boom")
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({
      error: {
        code: "INTERNAL",
        message: "Internal server error",
        requestId: expect.any(String),
      },
    })
    expect(text).not.toContain("secret detail")
    expect(text).not.toContain("server.ts")
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("AppError with status ≥ 500 → generic message, real one only logged", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const res = await app.request("/api/v1/__test/app-error-internal")
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({
      error: {
        code: "INTERNAL",
        message: "Internal server error",
        requestId: expect.any(String),
      },
    })
    expect(text).not.toContain("secret detail")
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("secret detail"))
    spy.mockRestore()
  })

  it("HTTPException 5xx → message scrubbed", async () => {
    const res = await app.request("/api/v1/__test/http-exception-5xx")
    expect(res.status).toBe(502)
    const text = await res.text()
    expect(JSON.parse(text).error).toMatchObject({
      code: "INTERNAL",
      message: "Internal server error",
    })
    expect(text).not.toContain("secret upstream detail")
  })

  it("zv → 422 VALIDATION_FAILED with dotted fieldErrors", async () => {
    const res = await app.request("/api/v1/__test/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "", hero: {} }),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_FAILED")
    expect(Object.keys(body.error.fieldErrors).sort()).toEqual([
      "hero.heading",
      "slug",
    ])
  })

  it("sets secureHeaders and X-Robots-Tag: noindex on success and error responses", async () => {
    for (const path of [
      "/api/v1/health/live",
      "/api/v1/nope",
      "/api/v1/__test/boom",
    ]) {
      const spy = vi.spyOn(console, "error").mockImplementation(() => undefined)
      const res = await app.request(path)
      spy.mockRestore()
      expect(res.headers.get("x-content-type-options")).toBe("nosniff")
      expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN")
      expect(res.headers.get("strict-transport-security")).toContain("max-age=")
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }
  })
})

describe("body limits", () => {
  it("public: 64 KB ok, larger → 413 envelope", async () => {
    const ok = await app.request("/api/v1/public/__test/echo", {
      method: "POST",
      body: "a".repeat(64 * 1024),
    })
    expect(ok.status).toBe(200)
    const tooBig = await app.request("/api/v1/public/__test/echo", {
      method: "POST",
      body: "a".repeat(64 * 1024 + 1),
    })
    expect(tooBig.status).toBe(413)
    expect((await tooBig.json()).error.code).toBe("VALIDATION_FAILED")
  })

  it("admin: 1 MB ok, larger → 413 envelope", async () => {
    const headers = { origin: ORIGIN }
    const ok = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers,
      body: "a".repeat(1024 * 1024),
    })
    expect(ok.status).toBe(200)
    const tooBig = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers,
      body: "a".repeat(1024 * 1024 + 1),
    })
    expect(tooBig.status).toBe(413)
  })
})

describe("sameOrigin on /api/v1/admin/*", () => {
  const post = (headers: Record<string, string>) =>
    app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers,
      body: "x",
    })

  it("allows the app origin", async () => {
    expect((await post({ origin: ORIGIN })).status).toBe(200)
  })

  it("allows Sec-Fetch-Site: same-origin when Origin is absent", async () => {
    expect((await post({ "sec-fetch-site": "same-origin" })).status).toBe(200)
  })

  it("rejects a foreign origin with 403 FORBIDDEN", async () => {
    const res = await post({ origin: "https://evil.example" })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe("FORBIDDEN")
  })

  it("rejects a foreign Origin even with Sec-Fetch-Site: same-origin (Origin wins)", async () => {
    const res = await post({
      origin: "https://evil.example",
      "sec-fetch-site": "same-origin",
    })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe("FORBIDDEN")
  })

  it("rejects Sec-Fetch-Site: same-site when Origin is absent", async () => {
    expect((await post({ "sec-fetch-site": "same-site" })).status).toBe(403)
  })

  it("rejects an unsafe request with neither header", async () => {
    expect((await post({})).status).toBe(403)
  })

  it("lets safe methods through", async () => {
    const res = await app.request("/api/v1/admin/__test/missing", {
      headers: { origin: "https://evil.example" },
    })
    expect(res.status).toBe(404)
  })
})
