import { afterEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"

import { TEST_DATABASE_URL } from "../db"

afterEach(() => {
  process.env.DATABASE_URL = TEST_DATABASE_URL
})

describe("health endpoints", () => {
  it("GET /api/v1/health → 200 when Postgres is reachable", async () => {
    const res = await app.request("/api/v1/health")
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "ok", db: "ok" })
  })

  it("GET /api/v1/health → 503 {status:unavailable} when Postgres is unreachable (closed port)", async () => {
    process.env.DATABASE_URL = "postgres://sp:sp@127.0.0.1:1/sp_test"
    const res = await app.request("/api/v1/health")
    expect(res.status).toBe(503)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ status: "unavailable" })
    expect(text).not.toContain("ECONNREFUSED")
  })

  it("GET /api/v1/health/live → 200 even when Postgres is unreachable", async () => {
    process.env.DATABASE_URL = "postgres://sp:sp@127.0.0.1:1/sp_test"
    const res = await app.request("/api/v1/health/live")
    expect(res.status).toBe(200)
  })
})
