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
    expect(readme).toContain(
      "docker compose -f docker-compose.dev.yml up -d && pnpm db:migrate && pnpm db:seed && pnpm demo:seed"
    )
  })
})
