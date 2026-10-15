import { afterEach, describe, expect, it } from "vitest"

import { getEnv, parseEnv } from "@/server/env"
import { getSiteEnv } from "@/server/lib/site-env"

const VALID = {
  DATABASE_URL: "postgres://sp:sp@127.0.0.1:5432/sp_dev",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://staging.example.ie",
  NODE_ENV: "production",
}

const KEYS = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NODE_ENV",
] as const
// Next types NODE_ENV as read-only; tests need to set it.
const ENV = process.env as Record<string, string | undefined>
const saved = Object.fromEntries(KEYS.map((k) => [k, ENV[k]]))

function setEnv(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) {
    if (values[k] === undefined) delete ENV[k]
    else ENV[k] = values[k]
  }
}

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete ENV[k]
    else ENV[k] = saved[k]
  }
})

describe("parseEnv", () => {
  it("accepts a valid env and defaults NODE_ENV to development", () => {
    const env = parseEnv({ ...VALID, NODE_ENV: undefined })
    expect(env).toEqual({ ...VALID, NODE_ENV: "development" })
  })

  it("names every missing variable in one multi-line error", () => {
    expect(() => parseEnv({})).toThrowError(
      [
        "Invalid environment configuration:",
        "  - DATABASE_URL: is required",
        "  - BETTER_AUTH_SECRET: is required",
        "  - BETTER_AUTH_URL: is required",
        "Set these variables before starting the server (see .env.example).",
      ].join("\n")
    )
  })

  it("treats empty strings as missing", () => {
    expect(() => parseEnv({ ...VALID, DATABASE_URL: "" })).toThrowError(
      "  - DATABASE_URL: is required"
    )
  })

  it("rejects a BETTER_AUTH_SECRET shorter than 32 characters without echoing it", () => {
    let message = ""
    try {
      parseEnv({ ...VALID, BETTER_AUTH_SECRET: "short-secret-value" })
    } catch (err) {
      message = (err as Error).message
    }
    expect(message).toContain(
      "  - BETTER_AUTH_SECRET: must be at least 32 characters"
    )
    expect(message).not.toContain("short-secret-value")
  })

  it.each(["localhost:3000", "/admin", "ftp://example.ie", "not a url"])(
    "rejects BETTER_AUTH_URL %s (must be absolute http(s))",
    (value) => {
      expect(() => parseEnv({ ...VALID, BETTER_AUTH_URL: value })).toThrowError(
        "  - BETTER_AUTH_URL: must be an absolute http(s) URL"
      )
    }
  )

  it("accepts http and https BETTER_AUTH_URL", () => {
    expect(
      parseEnv({ ...VALID, BETTER_AUTH_URL: "http://localhost:3000" })
        .BETTER_AUTH_URL
    ).toBe("http://localhost:3000")
    expect(parseEnv(VALID).BETTER_AUTH_URL).toBe("https://staging.example.ie")
  })

  it("rejects a non-postgres DATABASE_URL", () => {
    expect(() =>
      parseEnv({ ...VALID, DATABASE_URL: "mysql://x@y/z" })
    ).toThrowError(
      "  - DATABASE_URL: must be a postgres:// or postgresql:// URL"
    )
  })

  it("lists several invalid vars at once", () => {
    let message = ""
    try {
      parseEnv({
        DATABASE_URL: VALID.DATABASE_URL,
        BETTER_AUTH_SECRET: "x",
        BETTER_AUTH_URL: "nope",
      })
    } catch (err) {
      message = (err as Error).message
    }
    expect(message.split("\n").filter((l) => l.startsWith("  - "))).toEqual([
      "  - BETTER_AUTH_SECRET: must be at least 32 characters",
      "  - BETTER_AUTH_URL: must be an absolute http(s) URL",
    ])
  })
})

describe("getEnv", () => {
  it("reads process.env lazily and re-validates when it changes", () => {
    setEnv({})
    expect(() => getEnv()).toThrowError(/DATABASE_URL: is required/)
    setEnv(VALID)
    expect(getEnv().BETTER_AUTH_URL).toBe("https://staging.example.ie")
    expect(getEnv()).toBe(getEnv())
    setEnv({ ...VALID, BETTER_AUTH_URL: "https://www.example.ie" })
    expect(getEnv().BETTER_AUTH_URL).toBe("https://www.example.ie")
  })
})

describe("getSiteEnv (spec §1.4)", () => {
  it("is production when the BETTER_AUTH_URL origin equals settings.site.productionUrl", () => {
    setEnv({ ...VALID, BETTER_AUTH_URL: "https://www.example.ie/" })
    expect(getSiteEnv("https://www.example.ie")).toBe("production")
  })

  it("is development when NODE_ENV is not production", () => {
    setEnv({ ...VALID, NODE_ENV: "development" })
    expect(getSiteEnv("https://www.example.ie")).toBe("development")
    setEnv({ ...VALID, NODE_ENV: undefined })
    expect(getSiteEnv()).toBe("development")
  })

  it("is staging for a production build on any other origin", () => {
    setEnv(VALID)
    expect(getSiteEnv("https://www.example.ie")).toBe("staging")
    expect(getSiteEnv()).toBe("staging")
    expect(getSiteEnv("not a url")).toBe("staging")
  })
})
