import { spawnSync } from "node:child_process"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { pages, services } from "@/server/db/schema"
import { seedContent, seedIfEmpty } from "@/server/db/seed"

import { resetDb, TEST_DATABASE_URL } from "../db"

const count = async (table: string) => {
  const { rows } = await getDb().execute<{ n: number }>(
    sql.raw(`select count(*)::int as n from "${table}"`)
  )
  return rows[0].n
}

beforeEach(resetDb)

describe("seedIfEmpty (container auto-seed, spec §1.2 #6)", () => {
  it("seeds an empty database", async () => {
    const result = await seedIfEmpty(getDb())
    expect(result.seeded).toBe(true)
    expect(await count("pages")).toBeGreaterThan(0)
    expect(await count("services")).toBeGreaterThan(0)
  })

  it("leaves a database with content untouched (deleted rows stay deleted)", async () => {
    await seedContent(getDb())
    const [first] = await getDb().select().from(services).limit(1)
    await getDb().delete(services).where(eq(services.id, first.id))
    await getDb()
      .update(pages)
      .set({ status: "draft" })
      .where(eq(pages.key, "home"))
    const before = await count("services")

    const result = await seedIfEmpty(getDb())

    expect(result).toEqual({ seeded: false, pages: await count("pages") })
    expect(await count("services")).toBe(before)
    const [home] = await getDb()
      .select({ status: pages.status })
      .from(pages)
      .where(eq(pages.key, "home"))
    expect(home.status).toBe("draft")
  })

  it("is idempotent: a second run after an auto-seed does nothing", async () => {
    expect((await seedIfEmpty(getDb())).seeded).toBe(true)
    const pagesAfterFirst = await count("pages")
    expect(await seedIfEmpty(getDb())).toEqual({
      seeded: false,
      pages: pagesAfterFirst,
    })
  })
})

describe("db:seed --if-empty (what docker-entrypoint.sh runs)", () => {
  const run = (url: string) =>
    spawnSync("pnpm", ["--silent", "db:seed", "--if-empty"], {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: url,
        BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
        BETTER_AUTH_URL: "http://localhost:3000",
      },
    })

  it("seeds an empty database and logs what it inserted", async () => {
    const result = run(TEST_DATABASE_URL)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(
      /\[db:seed\] empty database \(no pages\): content seeded \(media \+\d+, .*pages \+\d+/
    )
    expect(await count("pages")).toBeGreaterThan(0)
  }, 60_000)

  it("skips a database that has content and says so", async () => {
    await seedContent(getDb())
    const n = await count("pages")
    const result = run(TEST_DATABASE_URL)
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain(
      `[db:seed] ${n} page(s) already exist: auto-seed skipped, no data changed`
    )
  }, 60_000)

  it("needs no --allow-production (it never writes to a database with content)", () => {
    // Non-disposable, unresolvable host: the guard must not reject it first;
    // the run then fails on the connection, not on the disposable check.
    const result = run("postgres://sp:sp@db.invalid:5432/security")
    expect(result.status).toBe(1)
    expect(result.stderr).not.toContain("--allow-production")
  }, 60_000)
})
