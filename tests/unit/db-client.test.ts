import { describe, expect, it } from "vitest"

import { getDb, pingDb } from "@/server/db/client"
import { AppError } from "@/server/lib/errors"

describe("getDb", () => {
  it("throws AppError INTERNAL when DATABASE_URL is missing (lazy: importing did not throw)", () => {
    delete process.env.DATABASE_URL
    let caught: unknown
    try {
      getDb()
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(AppError)
    expect((caught as AppError).code).toBe("INTERNAL")
    expect((caught as AppError).message).toBe("DATABASE_URL is not set")
  })

  it("pingDb returns false instead of throwing when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL
    await expect(pingDb()).resolves.toBe(false)
  })
})
