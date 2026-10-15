import { spawnSync } from "node:child_process"

import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"

import { resetDb, TEST_DATABASE_URL } from "../db"
import { authPost } from "../helpers/auth"

/** Runs a package script the way an operator does (tsx + server-only hook). */
function run(script: string, args: string[], env: Record<string, string> = {}) {
  return spawnSync("pnpm", ["--silent", script, ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123456789abcdef",
      BETTER_AUTH_URL: "http://localhost:3000",
      ...env,
    },
  })
}

beforeEach(async () => {
  await resetDb()
})

describe("operator scripts", { timeout: 60_000 }, () => {
  it("pnpm admin:create creates an owner and prints the set-password link", async () => {
    const result = run("admin:create", [
      "--email",
      "boss@example.ie",
      "--name",
      "Bea Boss",
    ])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      "[admin:create] Owner created: Bea Boss <boss@example.ie>"
    )
    expect(result.stdout).toMatch(
      /http:\/\/localhost:3000\/admin\/set-password\?token=[\w-]+/
    )
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, "boss@example.ie"))
    expect(row.role).toBe("owner")
  })

  it("pnpm admin:create without arguments prints usage and exits 1", () => {
    const result = run("admin:create", [])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Usage: admin:create --email")
  })

  it("pnpm demo:seed refuses a non-disposable database unless --allow-production", () => {
    const result = run("demo:seed", ["--password", "demo-password-123"], {
      DATABASE_URL: "postgres://sp:sp@db.example.com:5432/security",
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      "Refusing to write seed or demo data to db.example.com:5432/security"
    )
    expect(result.stderr).not.toContain("sp:sp")
  })

  it("pnpm demo:seed seeds sp_test and prints one line per role", () => {
    const result = run("demo:seed", ["--password", "demo-password-123"])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("created owner@demo.local (owner)")
    expect(result.stdout).toContain("7 demo accounts ready")
    expect(result.stdout + result.stderr).not.toContain("demo-password-123")
  })

  it("pnpm demo:seed takes the password from DEMO_PASSWORD and never prints it", async () => {
    const result = run("demo:seed", [], {
      DEMO_PASSWORD: "env-demo-password-456",
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("7 demo accounts ready")
    expect(result.stdout + result.stderr).not.toContain("env-demo-password")
    const res = await authPost("/sign-in/email", {
      email: "viewer@demo.local",
      password: "env-demo-password-456",
    })
    expect(res.status).toBe(200)
  })

  it("pnpm demo:seed without --password or DEMO_PASSWORD prints usage", () => {
    const result = run("demo:seed", [], { DEMO_PASSWORD: "" })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Usage: demo:seed --password")
    expect(result.stderr).toContain("DEMO_PASSWORD")
  })
})
