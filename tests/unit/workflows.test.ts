import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const ci = readFileSync(".github/workflows/ci.yml", "utf8")
const deploy = readFileSync(".github/workflows/deploy.yml", "utf8")

describe("CI + deploy gating (master 10.4, spec §14)", () => {
  it("CI runs every gate, with Postgres and Mailpit where needed", () => {
    for (const job of ["static:", "integration:", "build:", "e2e:", "image:"])
      expect(ci).toContain(`  ${job}`)
    for (const command of [
      "pnpm lint",
      "pnpm exec next typegen",
      "pnpm typecheck",
      "pnpm test:unit",
      "pnpm exec vitest run --project dom",
      "pnpm audit:deps",
      "pnpm test:integration",
      "pnpm build",
      "pnpm test:e2e",
      "scripts/check-log-secrets.ts",
      "node scripts/dist/seed.mjs --allow-production",
      "node scripts/dist/restore-drill.mjs",
    ])
      expect(ci).toContain(command)
    expect(ci.match(/axllent\/mailpit:v1\.31\.4/g)).toHaveLength(2)
    expect(ci).toContain("workflow_call:")
    expect(ci).not.toContain("test:visual")
  })

  it("deploy keeps its trigger and waits for CI", () => {
    expect(deploy).toMatch(
      /on:\n  push:\n    branches: \[main\]\n  workflow_dispatch:/
    )
    expect(deploy).toContain("uses: ./.github/workflows/ci.yml")
    expect(deploy).toContain("needs: ci")
    expect(deploy).toContain("skip_ci")
  })
})
