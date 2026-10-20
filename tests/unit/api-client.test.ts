import { describe, expect, it } from "vitest"

import { ApiError, errorMessage, unwrap } from "@/lib/api-client"

const response = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  )

describe("unwrap", () => {
  it("returns the JSON body of a 2xx response", async () => {
    await expect(unwrap(response(200, { ok: true }))).resolves.toEqual({
      ok: true,
    })
  })

  it("throws ApiError with the envelope's code, fieldErrors and current", async () => {
    const error = await unwrap(
      response(409, {
        error: {
          code: "CONFLICT",
          message: "Changed by someone else",
          current: { version: 4 },
          requestId: "r1",
        },
      })
    ).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 409,
      code: "CONFLICT",
      message: "Changed by someone else",
      current: { version: 4 },
      requestId: "r1",
      isConflict: true,
    })

    const invalid = (await unwrap(
      response(422, {
        error: {
          code: "VALIDATION_FAILED",
          message: "Invalid input",
          fieldErrors: { "hero.heading": ["Required"] },
        },
      })
    ).catch((e: unknown) => e)) as ApiError
    expect(invalid.fieldErrors).toEqual({ "hero.heading": ["Required"] })
  })

  it("survives a non-JSON error body", async () => {
    const error = (await unwrap(
      Promise.resolve(new Response("Bad gateway", { status: 502 }))
    ).catch((e: unknown) => e)) as ApiError
    expect(error.status).toBe(502)
    expect(error.code).toBe("INTERNAL")
    expect(error.message).toBe("Request failed (502)")
  })
})

describe("errorMessage", () => {
  it("uses the API message, or a generic one for network errors", () => {
    expect(
      errorMessage(
        new ApiError(403, { error: { code: "FORBIDDEN", message: "No" } })
      )
    ).toBe("No")
    expect(errorMessage(new TypeError("fetch failed"))).toBe(
      "Something went wrong. Check your connection and try again."
    )
  })
})
