import { describe, expect, it } from "vitest"

import { pgConstraint, pgErrorCode } from "@/server/lib/pg-errors"

describe("pg error helpers walk the cause chain (ledger P04-3)", () => {
  it("finds the SQLSTATE and constraint on the pg error itself or 1–3 causes deep", () => {
    const pg = { code: "23505", constraint: "services_slug_unique" }
    expect(pgErrorCode(pg)).toBe("23505")
    expect(pgErrorCode({ cause: pg })).toBe("23505")
    expect(pgErrorCode({ cause: { cause: { cause: pg } } })).toBe("23505")
    expect(pgConstraint({ cause: { cause: pg } })).toBe("services_slug_unique")
  })

  it("prefers a SQLSTATE over a Node error code on a wrapper", () => {
    expect(pgErrorCode({ code: "ECONNRESET", cause: { code: "40001" } })).toBe(
      "40001"
    )
  })

  it("never mistakes a five-letter Node error code for a SQLSTATE", () => {
    for (const code of ["EPIPE", "EPERM", "EBUSY", "EIO"])
      expect(pgErrorCode({ code })).toBeUndefined()
    expect(pgErrorCode({ code: "EPIPE", cause: { code: "57P01" } })).toBe(
      "57P01"
    )
    expect(pgErrorCode({ code: "XX000" })).toBe("XX000")
    expect(pgErrorCode({ code: "P0001" })).toBe("P0001")
  })

  it("stops on cycles and deep chains, and ignores non-objects", () => {
    const cyclic: { cause?: unknown } = {}
    cyclic.cause = cyclic
    expect(pgErrorCode(cyclic)).toBeUndefined()
    let deep: unknown = { code: "23503" }
    for (let i = 0; i < 6; i++) deep = { cause: deep }
    expect(pgErrorCode(deep)).toBeUndefined()
    expect(pgErrorCode(null)).toBeUndefined()
    expect(pgErrorCode("23505")).toBeUndefined()
  })
})
