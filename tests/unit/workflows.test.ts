import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const ci = readFileSync(".github/workflows/ci.yml", "utf8")
const deploy = readFileSync(".github/workflows/deploy.yml", "utf8")
const dependabot = readFileSync(".github/dependabot.yml", "utf8")

/** The `if:` line of `job` in a workflow (first one after the job key). */
const jobIf = (workflow: string, job: string) =>
  workflow.split(`\n  ${job}:\n`)[1]?.match(/\n    if: (.*)\n/)?.[1] ?? ""

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

  it("CI runs once per change: PRs directly, main through deploy.yml", () => {
    expect(ci).toMatch(/on:\n  pull_request:\n  workflow_call:\n/)
    expect(ci).not.toMatch(/^  push:/m)
    expect(ci).toContain(
      "cancel-in-progress: ${{ github.event_name == 'pull_request' }}"
    )
  })

  it("every action is pinned by commit SHA with its version noted", () => {
    for (const workflow of [ci, deploy]) {
      const uses = [...workflow.matchAll(/uses: (\S+)(.*)/g)].filter(
        ([, ref]) => !ref!.startsWith("./")
      )
      expect(uses.length).toBeGreaterThan(0)
      for (const [line, ref, comment] of uses) {
        expect(ref, line).toMatch(/@[0-9a-f]{40}$/)
        expect(comment, line).toMatch(/^ # v\d+\.\d+\.\d+$/)
      }
    }
    expect(dependabot).toContain("package-ecosystem: github-actions")
    expect(dependabot).toContain("interval: weekly")
    expect(ci).not.toMatch(/image: postgres:17\n/)
  })

  it("deploy keeps its trigger and waits for CI", () => {
    expect(deploy).toMatch(
      /on:\n  push:\n    branches: \[main\]\n  workflow_dispatch:/
    )
    expect(deploy).toContain("uses: ./.github/workflows/ci.yml")
    expect(deploy).toContain("needs: ci")
    expect(deploy).toContain("skip_ci")
  })

  it("only main deploys, and the skip_ci emergency path reaches the deploy", () => {
    for (const job of ["ci", "build-and-push", "deploy"])
      expect(jobIf(deploy, job), job).toContain(
        "github.ref == 'refs/heads/main'"
      )
    expect(jobIf(deploy, "build-and-push")).toContain("!cancelled()")
    expect(jobIf(deploy, "deploy")).toContain("!cancelled()")
    expect(jobIf(deploy, "deploy")).toContain(
      "needs.build-and-push.result == 'success'"
    )
  })

  it("only build-and-push may write packages", () => {
    expect(deploy.match(/packages: write/g)).toHaveLength(1)
    const buildJob = deploy
      .split("\n  build-and-push:\n")[1]!
      .split("\n  deploy:\n")[0]!
    expect(buildJob).toContain("packages: write")
    expect(deploy).toMatch(/^permissions:\n  contents: read\n/m)
  })
})
