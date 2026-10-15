import { describe, expect, it } from "vitest"

import {
  assertDisposable,
  describeDatabase,
  isDisposableDatabase,
} from "@/server/db/seed/guard"

describe("seed guard (spec §14)", () => {
  it.each([
    "postgres://sp:sp@db.internal:5432/sp_dev",
    "postgres://sp:sp@db.internal:5432/sp_test",
    "postgres://sp:sp@db.internal:5432/security_e2e",
    "postgres://sp:sp@localhost:5432/security",
    "postgres://sp:sp@127.0.0.1:5432/anything",
    "postgres://sp:sp@[::1]:5432/anything",
  ])("treats %s as disposable", (url) => {
    expect(isDisposableDatabase(url)).toBe(true)
    expect(() => assertDisposable(url, false)).not.toThrow()
  })

  it.each([
    "postgres://sp:secret@db.example.com:5432/security",
    "postgres://sp:secret@10.0.0.5:5432/sp_development",
    "postgres://sp:secret@db.example.com:5432/test_prod",
    "not a url",
  ])("refuses %s without --allow-production", (url) => {
    expect(isDisposableDatabase(url)).toBe(false)
    expect(() => assertDisposable(url, false)).toThrow("--allow-production")
  })

  it("never echoes credentials", () => {
    let message = ""
    try {
      assertDisposable(
        "postgres://sp:supersecret@db.example.com:5432/security",
        false
      )
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).toContain("db.example.com:5432/security")
    expect(message).not.toContain("supersecret")
    expect(describeDatabase("postgres://u:p@h:1/d")).toBe("h:1/d")
  })

  it("--allow-production bypasses the check", () => {
    expect(() =>
      assertDisposable(
        "postgres://sp:secret@db.example.com:5432/security",
        true
      )
    ).not.toThrow()
  })
})
