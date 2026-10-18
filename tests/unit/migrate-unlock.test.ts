import { describe, expect, it, vi } from "vitest"

const queries: string[] = []
vi.mock("pg", () => {
  class Client {
    async connect() {}
    async query(sql: string) {
      queries.push(sql)
      if (sql.includes("pg_advisory_unlock"))
        throw new Error("Connection terminated unexpectedly")
      return { rows: [] }
    }
    async end() {
      throw new Error("Client was closed and is not queryable")
    }
  }
  return { Client }
})
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({}) }))
vi.mock("drizzle-orm/node-postgres/migrator", () => ({
  migrate: async () => {
    throw new Error('relation "pages" already exists')
  },
}))

import { runMigrations } from "@/server/db/migrate"

describe("runMigrations (ledger P01-4)", () => {
  it("surfaces the migration error even when unlocking and closing fail", async () => {
    await expect(
      runMigrations("postgres://sp:sp@127.0.0.1:5432/sp_test", "/tmp/none")
    ).rejects.toThrow('relation "pages" already exists')
    expect(queries.some((q) => q.includes("pg_advisory_unlock"))).toBe(true)
  })
})
