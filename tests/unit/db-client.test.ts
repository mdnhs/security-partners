import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { getDb, pingDb } from "@/server/db/client"
import { AppError } from "@/server/lib/errors"

const saved = { ...process.env }

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET =
    "test-secret-0123456789abcdef0123456789abcdef"
  process.env.BETTER_AUTH_URL = "http://localhost:3000"
})

afterEach(() => {
  process.env = { ...saved }
})

function caughtFrom(fn: () => unknown): unknown {
  try {
    fn()
  } catch (err) {
    return err
  }
  return undefined
}

describe("getDb", () => {
  it("throws AppError INTERNAL when DATABASE_URL is missing (lazy: importing did not throw)", () => {
    delete process.env.DATABASE_URL
    const caught = caughtFrom(() => getDb())
    expect(caught).toBeInstanceOf(AppError)
    expect((caught as AppError).code).toBe("INTERNAL")
    expect((caught as AppError).message).toContain(
      "DATABASE_URL: is required"
    )
  })

  it("validates DATABASE_URL through server/env.ts (no unchecked process.env read)", () => {
    process.env.DATABASE_URL = "mysql://user:hunter2@db.example.com/app"
    const caught = caughtFrom(() => getDb())
    expect(caught).toBeInstanceOf(AppError)
    expect((caught as AppError).message).toContain(
      "DATABASE_URL: must be a postgres:// or postgresql:// URL"
    )
    expect((caught as AppError).message).not.toContain("hunter2")
  })

  it("pingDb returns false instead of throwing when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL
    await expect(pingDb()).resolves.toBe(false)
  })
})
