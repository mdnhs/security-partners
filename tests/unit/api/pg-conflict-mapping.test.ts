import { describe, expect, it, vi } from "vitest"

import { createApp } from "@/server/api/app"

// Final review minor 1: a deadlock or serialization failure is a retryable
// clash between two saves, not a server error.
const app = createApp()
const pgError = (code: string) =>
  Object.assign(new Error("Failed query"), {
    cause: Object.assign(new Error("deadlock detected"), { code }),
  })
app.get("/v1/__test/pg-40P01", () => {
  throw pgError("40P01")
})
app.get("/v1/__test/pg-40001", () => {
  throw pgError("40001")
})

describe("onError maps Postgres concurrency failures to 409", () => {
  it.each(["40P01", "40001"])("%s → 409 CONFLICT, try again", async (code) => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const res = await app.request(`/api/v1/__test/pg-${code}`)
    expect(res.status).toBe(409)
    const body = (await res.json()) as {
      error: { code: string; message: string }
    }
    expect(body.error).toMatchObject({
      code: "CONFLICT",
      message: "Someone else saved at the same time. Try again.",
    })
  })
})
