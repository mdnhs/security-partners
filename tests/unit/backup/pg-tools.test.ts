import { afterEach, describe, expect, it } from "vitest"

import { pgEnv, runPgTool, withDatabase } from "@/server/lib/backup/pg-tools"

const URL_WITH_PASSWORD =
  "postgres://backup:s3cr%40t@db.internal:5433/sp_prod?sslmode=require"

describe("pgEnv", () => {
  it("moves every connection part into libpq variables (password never on argv)", () => {
    const env = pgEnv(URL_WITH_PASSWORD, {
      PATH: "/usr/bin",
      PGPASSWORD: "stale",
    })
    expect(env).toMatchObject({
      PATH: "/usr/bin",
      PGHOST: "db.internal",
      PGPORT: "5433",
      PGUSER: "backup",
      PGPASSWORD: "s3cr@t",
      PGDATABASE: "sp_prod",
      PGSSLMODE: "require",
      PGCONNECT_TIMEOUT: "10",
    })
  })

  it("drops inherited libpq variables the URL does not set", () => {
    const env = pgEnv("postgres://sp@127.0.0.1/sp_dev", {
      PGPASSWORD: "leaked",
      PGSSLMODE: "disable",
    })
    expect(env.PGPASSWORD).toBeUndefined()
    expect(env.PGSSLMODE).toBeUndefined()
  })
})

describe("withDatabase", () => {
  it("points the same server at another database", () => {
    expect(
      withDatabase(
        "postgres://sp:sp@127.0.0.1:5432/sp_test",
        "sp_test_restore_drill"
      )
    ).toBe("postgres://sp:sp@127.0.0.1:5432/sp_test_restore_drill")
  })
})

describe("runPgTool", () => {
  const savedPath = process.env.PATH
  afterEach(() => {
    process.env.PATH = savedPath
  })

  it("explains a missing client binary", async () => {
    process.env.PATH = "/nonexistent-sp-test"
    await expect(
      runPgTool("pg_dump", ["--version"], "postgres://sp@127.0.0.1/sp_test")
    ).rejects.toThrow(
      "pg_dump was not found on PATH: install the PostgreSQL 17 client tools"
    )
  })
})
