import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const read = (file: string) => readFileSync(file, "utf8")

describe("operations docs (spec §14)", () => {
  it("the runbook covers every operation", () => {
    const runbook = read("docs/runbook.md")
    for (const heading of [
      "## Deploy",
      "## First production deploy",
      "## Rollback",
      "## Running scripts in the container",
      "## Backups and the restore drill",
      "## Restore a backup",
      "## Rotate BETTER_AUTH_SECRET",
      "## Copy a database between environments (db:sync)",
      "## Owner locked out",
      "## Client IPs and Traefik",
      "## Background jobs",
      "## Sessions and sign-in",
      "## Security headers",
      "## Custom code and Content-Security-Policy",
      "## Logs",
      "## Dependency audit",
      "## Known limitations",
    ])
      expect(runbook, heading).toContain(heading)
  })

  it("the launch checklist lists what the owner must do and confirm", () => {
    const launch = read("docs/launch.md")
    for (const text of [
      "## Agent did",
      "## Owner must do",
      "## Owner must confirm",
      "dokploy-network",
      "demo:remove",
      "Invisible",
      "Object Read & Write",
      "GDPR processor",
      "consent",
      "Monday–Friday",
      "(085) 8062369",
      "Ext 3",
    ])
      expect(launch, text).toContain(text)
  })

  it("the README is the project's, not the template's", () => {
    const readme = read("README.md")
    expect(readme).not.toContain("This is a Next.js template with shadcn/ui.")
    // --wait: migrations never race a cold Postgres (final review M12).
    expect(readme).toContain(
      "docker compose -f docker-compose.dev.yml up -d --wait && pnpm db:migrate && pnpm db:seed && pnpm demo:seed"
    )
  })

  it("the docs say to run exactly one app container (final review I1)", () => {
    const runbook = read("docs/runbook.md")
    const launch = read("docs/launch.md")
    for (const doc of [runbook, launch])
      expect(doc).toContain("run exactly one app container")
    expect(runbook).not.toContain("replicas never run one twice")
    expect(read("docker-compose.yml")).toMatch(/deploy:\n\s+replicas: 1\n/)
  })

  it("production bootstrap is 3 env vars + deploy + admin:create (auto-seed)", () => {
    const runbook = read("docs/runbook.md")
    expect(runbook).toContain("seed.mjs --if-empty")
    expect(read("docs/launch.md")).not.toContain(
      "seed.mjs --allow-production`), then"
    )
  })

  it("the brief's Changes log covers the final-review deviations (I4)", () => {
    const brief = read("docs/brief.md")
    const changes = brief.slice(brief.indexOf("## Changes"))
    for (const text of [
      "/api/v1/media/file",
      "consent: true",
      "fails open",
      "acknowledgement",
      "Mailpit",
      "proxy.ts",
      "client-side",
      "HMAC",
      "admin:create",
      "live preview",
      "auto-seed",
      "one app container",
      "favicon",
      "timezone",
      "logoOnDark",
    ])
      expect(changes, text).toContain(text)
  })
})
